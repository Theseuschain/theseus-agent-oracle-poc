// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title BridgeGuardian
/// @notice Commitment surface for the bridge guardian SHIP agent. The agent
///         runs off-chain, reads source-chain state (validator quorum,
///         finality, replay-protection, attestation freshness), and posts
///         ALLOW or REFUSE per attestation root. The bridge's destination
///         release function calls checkAllowed(attestationRoot) before
///         transferring funds and reverts when the agent's verdict is
///         REFUSE or when no verdict exists yet.
///
///         Mirrors AgentPriceFeed.sol / TerraFailsafe.sol: rounds are
///         append-only per key, only the agent address may write, view
///         functions revert on REFUSE so the destination release inherits
///         the revert.
///
///         Keyed by attestationRoot (bytes32) rather than enumerated action
///         types, because a bridge processes many distinct attestations and
///         each one needs its own decision history.
contract BridgeGuardian {
    enum Decision {
        UNINITIALIZED,
        ALLOW,
        REFUSE
    }

    /// @notice The SHIP agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    string public description;

    struct Verdict {
        Decision decision;
        uint256 updatedAt;
        bytes32 reasonHash;
    }

    /// @notice Latest verdict per attestation root.
    mapping(bytes32 => Verdict) public verdicts;

    /// @notice Append-only list of attestation roots the agent has ever
    ///         posted a verdict for. Useful for off-chain indexers.
    bytes32[] public touchedAttestations;

    event Allowed(bytes32 indexed attestationRoot, uint256 updatedAt, bytes32 reasonHash);
    event Refused(bytes32 indexed attestationRoot, uint256 updatedAt, bytes32 reasonHash);

    error NotAgent();
    error AttestationRefused(bytes32 attestationRoot, bytes32 reasonHash);
    error AttestationUnverified(bytes32 attestationRoot);

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, string memory description_) {
        agent = agent_;
        description = description_;
    }

    /// @notice Called by the SHIP agent when it allows the release.
    /// @param attestationRoot The bridge attestation root being decided on.
    /// @param reasonHash keccak256 of the agent's reasoning blob (kept off-chain).
    function reportAllow(bytes32 attestationRoot, bytes32 reasonHash) external onlyAgent {
        bool firstTouch = verdicts[attestationRoot].decision == Decision.UNINITIALIZED;
        verdicts[attestationRoot] = Verdict({
            decision: Decision.ALLOW,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        if (firstTouch) touchedAttestations.push(attestationRoot);
        emit Allowed(attestationRoot, block.timestamp, reasonHash);
    }

    /// @notice Called by the SHIP agent when it refuses the release.
    function reportRefuse(bytes32 attestationRoot, bytes32 reasonHash) external onlyAgent {
        bool firstTouch = verdicts[attestationRoot].decision == Decision.UNINITIALIZED;
        verdicts[attestationRoot] = Verdict({
            decision: Decision.REFUSE,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        if (firstTouch) touchedAttestations.push(attestationRoot);
        emit Refused(attestationRoot, block.timestamp, reasonHash);
    }

    /// @notice Reverts if the agent's latest verdict for this attestation is
    ///         REFUSE or if the attestation has never been visited. The
    ///         destination-side release function calls this before
    ///         transferring funds.
    function checkAllowed(bytes32 attestationRoot) external view {
        Verdict memory v = verdicts[attestationRoot];
        if (v.decision == Decision.UNINITIALIZED) revert AttestationUnverified(attestationRoot);
        if (v.decision == Decision.REFUSE) revert AttestationRefused(attestationRoot, v.reasonHash);
    }

    /// @notice Latest decision without reverting; callers can inspect.
    function latestDecision(bytes32 attestationRoot) external view returns (Decision) {
        return verdicts[attestationRoot].decision;
    }

    /// @notice True iff the agent has posted an ALLOW verdict for this attestation.
    function isAllowed(bytes32 attestationRoot) external view returns (bool) {
        return verdicts[attestationRoot].decision == Decision.ALLOW;
    }

    /// @notice Number of distinct attestation roots the agent has ever posted on.
    function touchedAttestationCount() external view returns (uint256) {
        return touchedAttestations.length;
    }
}
