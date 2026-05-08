// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title TerraFailsafe
/// @notice Commitment surface for the Terra Failsafe SHIP agent. The agent
///         runs off-chain, reasons over the protocol's vault metrics, and
///         posts ALLOW or REFUSE per action type (MINT, REDEEM). The
///         protocol vault calls checkAllowed(action) before executing the
///         action and reverts when the agent's latest verdict is REFUSE.
///
///         Mirrors AgentPriceFeed.sol's pattern: rounds are append-only,
///         only the agent address may write, view functions revert on
///         REFUSE so any path that touches the gate reverts with it.
contract TerraFailsafe {
    enum Action {
        MINT,
        REDEEM
    }

    enum Decision {
        UNINITIALIZED,
        ALLOW,
        REFUSE
    }

    /// @notice The SHIP agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    string public description;

    /// @notice Per-action latest round id. Round ids are monotonic per action.
    mapping(Action => uint80) public latestRoundId;

    struct Round {
        Decision decision;
        uint256 startedAt;
        uint256 updatedAt;
        bytes32 reasonHash;
    }

    /// @notice rounds[action][roundId] = Round
    mapping(Action => mapping(uint80 => Round)) public rounds;

    event Allowed(Action indexed action, uint80 indexed roundId, uint256 updatedAt, bytes32 reasonHash);
    event Refused(Action indexed action, uint80 indexed roundId, uint256 updatedAt, bytes32 reasonHash);

    error NotAgent();
    error ActionRefused(Action action, bytes32 reasonHash);
    error StaleRound(Action action);

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, string memory description_) {
        agent = agent_;
        description = description_;
    }

    /// @notice Called by the SHIP agent when it allows the action.
    /// @param action MINT or REDEEM.
    /// @param reasonHash keccak256 of the agent's reasoning blob (kept off-chain).
    function reportAllow(Action action, bytes32 reasonHash) external onlyAgent {
        uint80 nextId = latestRoundId[action] + 1;
        rounds[action][nextId] = Round({
            decision: Decision.ALLOW,
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        latestRoundId[action] = nextId;
        emit Allowed(action, nextId, block.timestamp, reasonHash);
    }

    /// @notice Called by the SHIP agent when it refuses the action.
    /// @param action MINT or REDEEM.
    /// @param reasonHash keccak256 of the agent's reasoning blob (kept off-chain).
    function reportRefuse(Action action, bytes32 reasonHash) external onlyAgent {
        uint80 nextId = latestRoundId[action] + 1;
        rounds[action][nextId] = Round({
            decision: Decision.REFUSE,
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        latestRoundId[action] = nextId;
        emit Refused(action, nextId, block.timestamp, reasonHash);
    }

    /// @notice Reverts if the agent's latest verdict for this action is
    ///         REFUSE or if the action has never been visited. Protocol
    ///         vaults call this before executing mint/redeem.
    function checkAllowed(Action action) external view {
        uint80 latest = latestRoundId[action];
        if (latest == 0) revert StaleRound(action);
        Round memory r = rounds[action][latest];
        if (r.decision == Decision.REFUSE) revert ActionRefused(action, r.reasonHash);
    }

    /// @notice Latest decision for an action. Does not revert; callers can inspect.
    function latestDecision(Action action) external view returns (Decision) {
        uint80 latest = latestRoundId[action];
        if (latest == 0) return Decision.UNINITIALIZED;
        return rounds[action][latest].decision;
    }

    /// @notice Latest update timestamp for an action.
    function latestTimestamp(Action action) external view returns (uint256) {
        uint80 latest = latestRoundId[action];
        if (latest == 0) return 0;
        return rounds[action][latest].updatedAt;
    }

    /// @notice Read a historical round for an action.
    function getRound(Action action, uint80 roundId)
        external
        view
        returns (Decision decision, uint256 startedAt, uint256 updatedAt, bytes32 reasonHash)
    {
        Round memory r = rounds[action][roundId];
        return (r.decision, r.startedAt, r.updatedAt, r.reasonHash);
    }
}
