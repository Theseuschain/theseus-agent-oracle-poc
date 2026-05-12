// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

/// @title LaunchSniperFund
/// @notice Sovereign-shape agent that evaluates new token launches on Base
///         mainnet and records its decisions as paper trades on Sepolia.
///         No real tokens move. The fund's entire state is a virtual ledger
///         maintained by this contract.
///
///         The shape mirrors SovereignFund: a single SHIP agent is the sole
///         writer, every tick is append-only, every decision commits a
///         reasonHash pointing to an off-chain blob with the agent's
///         evaluation, the price source, and the contract-source review.
///
///         Honesty model: the agent reports both legs of every paper fill
///         (amountToken and amountUsdc). Off-chain observers can verify each
///         fill is realistic by reading the corresponding Base mainnet pool
///         at the tick's block.timestamp. The reasonHash should point at a
///         blob that names the pool and the observed price.
contract LaunchSniperFund {
    enum Action {
        HOLD,         // heartbeat tick: no specific token evaluated
        PASS,         // evaluated a specific token, declined to buy
        BUY_TOKEN,    // paper buy: spend amountUsdc, gain amountToken
        SELL_TOKEN    // paper sell: lose amountToken, gain amountUsdc
    }

    struct Position {
        uint256 amount;          // paper holdings, in token's native decimals
        uint256 costBasisUsdc;   // cumulative USDC spent acquiring this token
        uint256 proceedsUsdc;    // cumulative USDC received selling this token
        bool open;
    }

    struct Tick {
        Action action;
        address token;           // address(0) if HOLD
        uint256 amountToken;
        uint256 amountUsdc;
        uint256 paperUsdcAfter;  // virtual USDC balance after the tick
        bytes32 reasonHash;
        uint256 timestamp;
    }

    /// @notice Sole writer. Centralized agent (EOA) for the demo.
    address public immutable agent;

    /// @notice Starting virtual USDC. Set once at deploy.
    uint256 public immutable startingUsdc;

    /// @notice Current virtual USDC balance (paper).
    uint256 public paperUsdc;

    /// @notice token => current paper position.
    mapping(address => Position) public positions;

    /// @notice Every token the agent has ever touched (PASS, BUY, or SELL).
    ///         Used for off-chain enumeration and dashboards.
    address[] public tokens;
    mapping(address => bool) private touched;

    /// @notice Append-only tick history.
    Tick[] public ticks;

    string public description;

    event Ticked(
        uint256 indexed tickIndex,
        Action indexed action,
        address indexed token,
        uint256 amountToken,
        uint256 amountUsdc,
        uint256 paperUsdcAfter,
        bytes32 reasonHash
    );

    error NotAgent();
    error InvalidAction();
    error InsufficientPaperUsdc();
    error InsufficientPosition();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(
        address agent_,
        uint256 startingUsdc_,
        string memory description_
    ) {
        agent = agent_;
        startingUsdc = startingUsdc_;
        paperUsdc = startingUsdc_;
        description = description_;
    }

    /// @notice Called by the agent on its own schedule. Records the decision
    ///         and updates the virtual ledger. No real ERC20 transfers.
    /// @param action HOLD, PASS, BUY_TOKEN, or SELL_TOKEN.
    /// @param token For PASS/BUY/SELL, the token being evaluated. Must be
    ///         address(0) for HOLD.
    /// @param amountToken Paper amount of `token` involved. Zero for HOLD/PASS.
    /// @param amountUsdc Paper amount of USDC involved (6 decimals). Zero for
    ///         HOLD/PASS.
    /// @param reasonHash keccak256 of the agent's off-chain evaluation blob.
    ///         The blob should name the pool, the observed price, and the
    ///         reasoning behind the action.
    function tick(
        Action action,
        address token,
        uint256 amountToken,
        uint256 amountUsdc,
        bytes32 reasonHash
    ) external onlyAgent {
        if (action == Action.HOLD) {
            if (token != address(0) || amountToken != 0 || amountUsdc != 0) {
                revert InvalidAction();
            }
        } else if (action == Action.PASS) {
            if (token == address(0)) revert InvalidAction();
            if (amountToken != 0 || amountUsdc != 0) revert InvalidAction();
            _touch(token);
        } else if (action == Action.BUY_TOKEN) {
            if (token == address(0)) revert InvalidAction();
            if (amountToken == 0 || amountUsdc == 0) revert InvalidAction();
            if (paperUsdc < amountUsdc) revert InsufficientPaperUsdc();
            paperUsdc -= amountUsdc;
            Position storage p = positions[token];
            p.amount += amountToken;
            p.costBasisUsdc += amountUsdc;
            p.open = true;
            _touch(token);
        } else {
            // SELL_TOKEN
            if (token == address(0)) revert InvalidAction();
            if (amountToken == 0 || amountUsdc == 0) revert InvalidAction();
            Position storage p = positions[token];
            if (p.amount < amountToken) revert InsufficientPosition();
            p.amount -= amountToken;
            p.proceedsUsdc += amountUsdc;
            paperUsdc += amountUsdc;
            if (p.amount == 0) p.open = false;
            _touch(token);
        }

        uint256 idx = ticks.length;
        ticks.push(Tick({
            action: action,
            token: token,
            amountToken: amountToken,
            amountUsdc: amountUsdc,
            paperUsdcAfter: paperUsdc,
            reasonHash: reasonHash,
            timestamp: block.timestamp
        }));
        emit Ticked(idx, action, token, amountToken, amountUsdc, paperUsdc, reasonHash);
    }

    function tickCount() external view returns (uint256) { return ticks.length; }
    function tokenCount() external view returns (uint256) { return tokens.length; }

    function latestTick() external view returns (Tick memory) {
        require(ticks.length > 0, "no ticks yet");
        return ticks[ticks.length - 1];
    }

    function _touch(address token) internal {
        if (!touched[token]) {
            touched[token] = true;
            tokens.push(token);
        }
    }
}
