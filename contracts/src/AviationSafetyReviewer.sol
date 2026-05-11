// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title AviationSafetyReviewer
/// @notice Commitment surface for the aviation safety reviewer SHIP agent.
///         The agent reads each proposed aircraft type-certification change
///         off-chain (manufacturer's summary, technical summary, sensor
///         architecture, pilot-override behavior, proposed training class)
///         and posts an advisory verdict: APPROVE, CAUTION, or REJECT. The
///         verdict is NOT a gate; the certificating authority can still
///         issue the airworthiness directive. The contract is the on-chain
///         record so accident investigators, airlines, and pilots can see
///         whether a change was independently flagged before delivery.
///
///         Same shape as GovernanceReviewer.sol: three-way decision keyed
///         by changeId, getVerdict does NOT revert (advisory, not gating),
///         agent-only writes.
contract AviationSafetyReviewer {
    enum Decision {
        UNINITIALIZED,
        APPROVE,
        CAUTION,
        REJECT
    }

    /// @notice The SHIP agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    string public description;

    struct Verdict {
        Decision decision;
        uint256 updatedAt;
        bytes32 reasonHash;
    }

    /// @notice Latest verdict per certification change id.
    mapping(uint256 => Verdict) public verdicts;

    /// @notice Append-only list of change ids the agent has ever posted on.
    uint256[] public touchedChanges;

    event Reviewed(
        uint256 indexed changeId,
        Decision indexed decision,
        uint256 updatedAt,
        bytes32 reasonHash
    );

    error NotAgent();
    error InvalidDecision();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, string memory description_) {
        agent = agent_;
        description = description_;
    }

    /// @notice Called by the SHIP agent to post a verdict on a change.
    /// @param changeId Numeric change id (mirrors FAA STC / ADCN tracking).
    /// @param decision APPROVE, CAUTION, or REJECT. UNINITIALIZED is not
    ///         a valid write value.
    /// @param reasonHash keccak256 of the agent's reasoning blob (kept off-chain).
    function review(uint256 changeId, Decision decision, bytes32 reasonHash)
        external
        onlyAgent
    {
        if (decision == Decision.UNINITIALIZED) revert InvalidDecision();
        bool firstTouch = verdicts[changeId].decision == Decision.UNINITIALIZED;
        verdicts[changeId] = Verdict({
            decision: decision,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        if (firstTouch) touchedChanges.push(changeId);
        emit Reviewed(changeId, decision, block.timestamp, reasonHash);
    }

    /// @notice Latest verdict for a change. Does NOT revert; the verdict
    ///         is advisory and downstream contracts read it freely.
    function getVerdict(uint256 changeId)
        external
        view
        returns (Decision decision, uint256 updatedAt, bytes32 reasonHash)
    {
        Verdict memory v = verdicts[changeId];
        return (v.decision, v.updatedAt, v.reasonHash);
    }

    /// @notice True iff the agent's latest verdict for this change is APPROVE.
    function isApproved(uint256 changeId) external view returns (bool) {
        return verdicts[changeId].decision == Decision.APPROVE;
    }

    /// @notice True iff the agent's latest verdict for this change is REJECT.
    function isRejected(uint256 changeId) external view returns (bool) {
        return verdicts[changeId].decision == Decision.REJECT;
    }

    /// @notice Number of distinct change ids the agent has ever posted on.
    function touchedChangeCount() external view returns (uint256) {
        return touchedChanges.length;
    }
}
