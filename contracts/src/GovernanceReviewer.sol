// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title GovernanceReviewer
/// @notice Commitment surface for the governance reviewer SHIP agent. The
///         agent reads each DAO proposal off-chain (text, calldata summary,
///         treasury and voting context) and posts an advisory verdict:
///         APPROVE, CAUTION, or REJECT. The verdict is NOT a gate; the DAO
///         can still vote however it wants. The contract is the on-chain
///         record so token-holders can read the agent's read before they
///         cast.
///
///         Differences from BridgeGuardian and TerraFailsafe:
///           - Three-way decision (APPROVE / CAUTION / REJECT), not binary.
///           - View functions do NOT revert on REJECT. Downstream contracts
///             can use the verdict however they like (display it to voters,
///             require timelock extension on REJECT, etc.). The whole point
///             is that this is advisory.
///           - Keyed by proposalId.
contract GovernanceReviewer {
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

    /// @notice Latest verdict per proposalId.
    mapping(uint256 => Verdict) public verdicts;

    /// @notice Append-only list of proposalIds the agent has ever posted on.
    uint256[] public touchedProposals;

    event Reviewed(
        uint256 indexed proposalId,
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

    /// @notice Called by the SHIP agent to post a verdict on a proposal.
    /// @param proposalId Numeric proposal id (mirrors the DAO's id).
    /// @param decision APPROVE, CAUTION, or REJECT. UNINITIALIZED is not
    ///         a valid write value.
    /// @param reasonHash keccak256 of the agent's reasoning blob (kept off-chain).
    function review(uint256 proposalId, Decision decision, bytes32 reasonHash)
        external
        onlyAgent
    {
        if (decision == Decision.UNINITIALIZED) revert InvalidDecision();
        bool firstTouch = verdicts[proposalId].decision == Decision.UNINITIALIZED;
        verdicts[proposalId] = Verdict({
            decision: decision,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        if (firstTouch) touchedProposals.push(proposalId);
        emit Reviewed(proposalId, decision, block.timestamp, reasonHash);
    }

    /// @notice Latest verdict for a proposal. Does NOT revert; the verdict
    ///         is advisory and downstream contracts read it freely.
    function getVerdict(uint256 proposalId)
        external
        view
        returns (Decision decision, uint256 updatedAt, bytes32 reasonHash)
    {
        Verdict memory v = verdicts[proposalId];
        return (v.decision, v.updatedAt, v.reasonHash);
    }

    /// @notice True iff the agent's latest verdict for this proposal is APPROVE.
    function isApproved(uint256 proposalId) external view returns (bool) {
        return verdicts[proposalId].decision == Decision.APPROVE;
    }

    /// @notice True iff the agent's latest verdict for this proposal is REJECT.
    function isRejected(uint256 proposalId) external view returns (bool) {
        return verdicts[proposalId].decision == Decision.REJECT;
    }

    /// @notice Number of distinct proposalIds the agent has ever posted on.
    function touchedProposalCount() external view returns (uint256) {
        return touchedProposals.length;
    }
}
