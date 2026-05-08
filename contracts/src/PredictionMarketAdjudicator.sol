// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title PredictionMarketAdjudicator
/// @notice Commitment surface for the resolver_oracle.ship agent. The agent
///         runs off-chain, reads the market question / criteria / deadline,
///         calls web_search for evidence, and posts a verdict per market_id.
///
///         Settlement contracts (Polymarket-shape parimutuel pools, etc.)
///         read getVerdict(marketId) to decide payouts. This contract holds
///         no funds and runs no payout logic; it is the on-chain record of
///         the agent's decisions.
///
///         Mirrors AgentPriceFeed.sol's pattern: only the agent address may
///         write, decisions can be RESOLVED or REFUSED, view functions
///         revert on REFUSED so any path that depends on a final verdict
///         reverts with it. RESOLVED is terminal; REFUSED is not, so the
///         agent can re-run on a market it previously declined to resolve
///         (for example, a market whose deadline had not yet passed).
contract PredictionMarketAdjudicator {
    enum Decision {
        UNINITIALIZED,
        RESOLVED,
        REFUSED
    }

    /// @notice The SHIP agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    string public description;

    struct Verdict {
        Decision decision;
        uint8 winningOption;
        uint8 confidencePct;
        uint256 updatedAt;
        bytes32 reasonHash;
    }

    /// @notice Latest verdict per market_id.
    mapping(uint256 => Verdict) public verdicts;

    /// @notice Append-only log of every market_id the agent has ever
    ///         posted a verdict for. Useful for off-chain indexers.
    uint256[] public touchedMarkets;

    event Resolved(
        uint256 indexed marketId,
        uint8 winningOption,
        uint8 confidencePct,
        uint256 updatedAt,
        bytes32 reasonHash
    );
    event Refused(uint256 indexed marketId, uint256 updatedAt, bytes32 reasonHash);

    error NotAgent();
    error AlreadyResolved(uint256 marketId);
    error InvalidWinningOption(uint8 winningOption, uint8 numOptions);
    error InvalidConfidence(uint8 confidencePct);
    error MarketRefused(uint256 marketId, bytes32 reasonHash);
    error MarketUnresolved(uint256 marketId);

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(address agent_, string memory description_) {
        agent = agent_;
        description = description_;
    }

    /// @notice Called by the SHIP agent to resolve a market.
    /// @param marketId Numeric market id matching the resolver_oracle's input.
    /// @param numOptions Total option count for the market (validated against winningOption).
    /// @param winningOption 0-based index into the market's options.
    /// @param confidencePct 0-100, mirrors the off-chain confidence_pct field.
    /// @param reasonHash keccak256 of the agent's evidence_summary.
    function resolve(
        uint256 marketId,
        uint8 numOptions,
        uint8 winningOption,
        uint8 confidencePct,
        bytes32 reasonHash
    ) external onlyAgent {
        if (verdicts[marketId].decision == Decision.RESOLVED) revert AlreadyResolved(marketId);
        if (winningOption >= numOptions) revert InvalidWinningOption(winningOption, numOptions);
        if (confidencePct > 100) revert InvalidConfidence(confidencePct);

        bool firstTouch = verdicts[marketId].decision == Decision.UNINITIALIZED;
        verdicts[marketId] = Verdict({
            decision: Decision.RESOLVED,
            winningOption: winningOption,
            confidencePct: confidencePct,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        if (firstTouch) touchedMarkets.push(marketId);
        emit Resolved(marketId, winningOption, confidencePct, block.timestamp, reasonHash);
    }

    /// @notice Called by the SHIP agent when it declines to resolve. The
    ///         agent may revisit the market later (e.g. after the deadline
    ///         passes) and post a RESOLVED verdict; REFUSED is not terminal.
    /// @param marketId Numeric market id.
    /// @param reasonHash keccak256 of the agent's reasoning blob.
    function refuse(uint256 marketId, bytes32 reasonHash) external onlyAgent {
        if (verdicts[marketId].decision == Decision.RESOLVED) revert AlreadyResolved(marketId);
        bool firstTouch = verdicts[marketId].decision == Decision.UNINITIALIZED;
        verdicts[marketId] = Verdict({
            decision: Decision.REFUSED,
            winningOption: 0,
            confidencePct: 0,
            updatedAt: block.timestamp,
            reasonHash: reasonHash
        });
        if (firstTouch) touchedMarkets.push(marketId);
        emit Refused(marketId, block.timestamp, reasonHash);
    }

    /// @notice Final verdict for a market. Reverts on REFUSED or
    ///         UNINITIALIZED so settlement contracts can wrap their
    ///         payout call in this read and inherit the revert.
    function getVerdict(uint256 marketId)
        external
        view
        returns (uint8 winningOption, uint8 confidencePct, uint256 updatedAt, bytes32 reasonHash)
    {
        Verdict memory v = verdicts[marketId];
        if (v.decision == Decision.REFUSED) revert MarketRefused(marketId, v.reasonHash);
        if (v.decision == Decision.UNINITIALIZED) revert MarketUnresolved(marketId);
        return (v.winningOption, v.confidencePct, v.updatedAt, v.reasonHash);
    }

    /// @notice Non-reverting view; returns the full Verdict including its
    ///         decision tag. Useful for indexers and UIs.
    function inspect(uint256 marketId) external view returns (Verdict memory) {
        return verdicts[marketId];
    }

    /// @notice True iff the agent has posted a RESOLVED verdict for this market.
    function isResolved(uint256 marketId) external view returns (bool) {
        return verdicts[marketId].decision == Decision.RESOLVED;
    }

    /// @notice Number of distinct markets the agent has ever posted on.
    function touchedMarketCount() external view returns (uint256) {
        return touchedMarkets.length;
    }
}
