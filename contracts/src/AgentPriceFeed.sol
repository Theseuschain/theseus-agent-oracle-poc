// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title AgentPriceFeed
/// @notice Chainlink-shaped price feed whose storage is written by a Theseus SHIP agent.
///         Aave V3 reads through this contract via its standard AggregatorV3Interface adapter.
///
///         The agent runs on a schedule, reads multiple venues, reconciles, and either:
///         - reports a price (decision == PRICED), or
///         - refuses (decision == REFUSED) when venue divergence exceeds policy thresholds.
///
///         Aave's price-touching paths revert when decision == REFUSED, which halts
///         new borrows, liquidations, and any LTV-sensitive operation. Withdrawals
///         that don't depend on price continue to work.
contract AgentPriceFeed {
    enum Decision {
        UNINITIALIZED,
        PRICED,
        REFUSED
    }

    /// @notice The SHIP agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    /// @notice Chainlink-style decimals. WETH/USD uses 8 to match Chainlink convention.
    uint8 public immutable decimals;

    string public description;

    uint80 public latestRoundId;

    struct Round {
        int256 answer;
        uint256 startedAt;
        uint256 updatedAt;
        Decision decision;
        bytes32 reasonHash;
    }

    mapping(uint80 => Round) public rounds;

    event PriceUpdated(uint80 indexed roundId, int256 answer, uint256 updatedAt);
    event Refused(uint80 indexed roundId, uint256 updatedAt, bytes32 reasonHash);

    error NotAgent();
    error InvalidDecision();
    error PriceRefused(bytes32 reasonHash);
    error StaleRound();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, uint8 decimals_, string memory description_) {
        agent = agent_;
        decimals = decimals_;
        description = description_;
    }

    /// @notice Called by the SHIP agent when it has a reconciled price.
    /// @dev Each agent run produces exactly one round. Round IDs are monotonic.
    function reportPrice(int256 answer) external onlyAgent {
        uint80 nextId = latestRoundId + 1;
        rounds[nextId] = Round({
            answer: answer,
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            decision: Decision.PRICED,
            reasonHash: bytes32(0)
        });
        latestRoundId = nextId;
        emit PriceUpdated(nextId, answer, block.timestamp);
    }

    /// @notice Called by the SHIP agent when it refuses to price.
    /// @param reasonHash keccak256 of the agent's reasoning blob (kept off-chain or in TensorCommit).
    function reportRefusal(bytes32 reasonHash) external onlyAgent {
        uint80 nextId = latestRoundId + 1;
        rounds[nextId] = Round({
            answer: 0,
            startedAt: block.timestamp,
            updatedAt: block.timestamp,
            decision: Decision.REFUSED,
            reasonHash: reasonHash
        });
        latestRoundId = nextId;
        emit Refused(nextId, block.timestamp, reasonHash);
    }

    /// @notice Chainlink AggregatorInterface (V2) compatibility.
    /// @dev This is what Aave V3's AaveOracle reads. Reverts on REFUSED so any
    ///      Aave path that touches the asset price reverts with it.
    function latestAnswer() external view returns (int256) {
        Round memory r = rounds[latestRoundId];
        if (r.decision == Decision.REFUSED) revert PriceRefused(r.reasonHash);
        if (r.decision == Decision.UNINITIALIZED) revert StaleRound();
        return r.answer;
    }

    function latestTimestamp() external view returns (uint256) {
        return rounds[latestRoundId].updatedAt;
    }

    /// @notice Chainlink AggregatorV3Interface compatibility.
    /// @dev Reverts on REFUSED so any V3-shaped consumer reverts with it.
    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        Round memory r = rounds[latestRoundId];
        if (r.decision == Decision.REFUSED) revert PriceRefused(r.reasonHash);
        if (r.decision == Decision.UNINITIALIZED) revert StaleRound();
        return (latestRoundId, r.answer, r.startedAt, r.updatedAt, latestRoundId);
    }

    /// @notice Read a historical round. Does not revert on REFUSED — callers can inspect.
    function getRoundData(uint80 roundId)
        external
        view
        returns (
            uint80 roundId_,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        Round memory r = rounds[roundId];
        return (roundId, r.answer, r.startedAt, r.updatedAt, roundId);
    }

    function latestDecision() external view returns (Decision) {
        return rounds[latestRoundId].decision;
    }
}
