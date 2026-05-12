// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @notice Minimal Uniswap V3 SwapRouter interface (exactInputSingle only).
///         Compatible with the canonical SwapRouter and SwapRouter02 on
///         every chain that hosts Uniswap V3 (Sepolia, Base Sepolia,
///         Arbitrum Sepolia, Optimism, etc.).
interface ISwapRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        payable
        returns (uint256 amountOut);
}

/// @title SovereignFund
/// @notice On-chain fund controlled by a single SHIP agent. Holds USDC and
///         WETH; the agent calls tick() on its own schedule to record a
///         decision and execute the resulting swap through a Uniswap V3
///         router. Append-only tick history is the audit log.
///
///         Two distinguishing features versus the gate-shape agents on the
///         poc:
///           - The agent is the SOLE caller. Nobody else writes.
///           - The contract HOLDS funds. Verdicts are append-only history;
///             the token balances are the current ledger.
///
///         For the demo "centralized agent" deployment, the agent is just
///         an EOA. The Theseus production version would have the agent be
///         a SHIP-registered address that signs verdicts under PoA.
contract SovereignFund {
    enum Action {
        HOLD,
        BUY_WETH,
        SELL_WETH
    }

    /// @notice The agent's address. Only it can call tick().
    address public immutable agent;

    /// @notice USDC and WETH tokens the fund holds.
    IERC20 public immutable usdc;
    IERC20 public immutable weth;

    /// @notice Uniswap V3 SwapRouter for executing swaps.
    ISwapRouter public immutable swapRouter;

    /// @notice Pool fee tier for the USDC/WETH pool (e.g. 500 = 0.05%,
    ///         3000 = 0.3%). Set once at deploy.
    uint24 public immutable poolFee;

    string public description;

    struct Tick {
        Action action;
        uint256 amountIn;          // input amount, in input-token decimals
        uint256 amountOut;         // actual amount received from swap
        uint256 minAmountOut;      // slippage floor the agent accepted
        uint256 usdcAfter;         // USDC balance after tick (snapshot)
        uint256 wethAfter;         // WETH balance after tick (snapshot)
        bytes32 reasonHash;        // keccak256 of off-chain reasoning blob
        uint256 timestamp;
    }

    /// @notice Append-only tick history.
    Tick[] public ticks;

    event Ticked(
        uint256 indexed tickIndex,
        Action indexed action,
        uint256 amountIn,
        uint256 amountOut,
        uint256 usdcAfter,
        uint256 wethAfter,
        bytes32 reasonHash
    );

    error NotAgent();
    error InvalidAction();
    error InsufficientBalance();
    error SwapFailed();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(
        address agent_,
        IERC20 usdc_,
        IERC20 weth_,
        ISwapRouter swapRouter_,
        uint24 poolFee_,
        string memory description_
    ) {
        agent = agent_;
        usdc = usdc_;
        weth = weth_;
        swapRouter = swapRouter_;
        poolFee = poolFee_;
        description = description_;
    }

    /// @notice Called by the agent on its own schedule. Records the
    ///         decision and executes the corresponding swap.
    /// @param action HOLD, BUY_WETH, or SELL_WETH.
    /// @param amountIn Input amount, in input token's native decimals.
    ///         For BUY_WETH this is USDC (6 decimals). For SELL_WETH this
    ///         is WETH (18 decimals). Must be 0 if action is HOLD.
    /// @param minAmountOut Slippage floor. The swap reverts if the router
    ///         returns less than this. The agent computes this off-chain
    ///         from its expected price and a slippage tolerance.
    /// @param deadline Unix timestamp after which the swap must revert.
    /// @param reasonHash keccak256 of the agent's reasoning blob.
    function tick(
        Action action,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline,
        bytes32 reasonHash
    ) external onlyAgent {
        if (action == Action.HOLD && amountIn != 0) revert InvalidAction();
        if (action != Action.HOLD && amountIn == 0) revert InvalidAction();

        uint256 amountOut = 0;

        if (action == Action.BUY_WETH) {
            amountOut = _swap(usdc, weth, amountIn, minAmountOut, deadline);
        } else if (action == Action.SELL_WETH) {
            amountOut = _swap(weth, usdc, amountIn, minAmountOut, deadline);
        }

        uint256 idx = ticks.length;
        ticks.push(
            Tick({
                action: action,
                amountIn: amountIn,
                amountOut: amountOut,
                minAmountOut: minAmountOut,
                usdcAfter: usdc.balanceOf(address(this)),
                wethAfter: weth.balanceOf(address(this)),
                reasonHash: reasonHash,
                timestamp: block.timestamp
            })
        );
        emit Ticked(
            idx,
            action,
            amountIn,
            amountOut,
            usdc.balanceOf(address(this)),
            weth.balanceOf(address(this)),
            reasonHash
        );
    }

    /// @notice Withdraw a token to a recipient. Agent-only escape hatch
    ///         (e.g. for migrating funds, redeeming profits). Append-only
    ///         tick history still reflects every trade, so this is auditable.
    function withdraw(IERC20 token, address to, uint256 amount) external onlyAgent {
        if (!token.transfer(to, amount)) revert SwapFailed();
    }

    /// @notice Number of ticks recorded since deployment.
    function tickCount() external view returns (uint256) {
        return ticks.length;
    }

    /// @notice Latest tick. Reverts if no ticks have happened yet.
    function latestTick() external view returns (Tick memory) {
        require(ticks.length > 0, "no ticks yet");
        return ticks[ticks.length - 1];
    }

    // ---------------------------------------------------------------
    // Internal
    // ---------------------------------------------------------------

    function _swap(
        IERC20 tokenIn,
        IERC20 tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) internal returns (uint256 amountOut) {
        if (tokenIn.balanceOf(address(this)) < amountIn) revert InsufficientBalance();

        // Reset and set fresh allowance. Some ERC20s (USDT in particular)
        // require setting to zero before changing a non-zero allowance.
        // USDC and WETH don't, but the pattern is harmless and worth keeping.
        tokenIn.approve(address(swapRouter), 0);
        tokenIn.approve(address(swapRouter), amountIn);

        amountOut = swapRouter.exactInputSingle(
            ISwapRouter.ExactInputSingleParams({
                tokenIn: address(tokenIn),
                tokenOut: address(tokenOut),
                fee: poolFee,
                recipient: address(this),
                deadline: deadline,
                amountIn: amountIn,
                amountOutMinimum: minAmountOut,
                sqrtPriceLimitX96: 0
            })
        );
        if (amountOut < minAmountOut) revert SwapFailed();
    }
}
