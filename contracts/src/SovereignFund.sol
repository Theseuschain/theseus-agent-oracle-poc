// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @title SovereignFund
/// @notice Commitment + execution surface for the sovereign-fund SHIP agent.
///         Different shape from the other Theseus demos. Holds capital
///         (USDC + WETH) and is controlled by the agent alone. The agent
///         calls tick() on its own schedule with a signed decision; the
///         contract records the decision and applies a mocked execution
///         to its position state. A production deployment would wire
///         _executeAt() to a DEX router (Uniswap V3 / similar).
///
///         The two distinguishing features versus the gate-shape agents:
///           - The agent is the SOLE caller. Nobody else writes here.
///           - The contract HOLDS funds. Verdicts are append-only history
///             but the position state is the current ledger.
///
///         Execution is mocked: the agent supplies the price at tick time
///         and the contract adjusts balances accordingly. This is the
///         demo's escape hatch; the function signature exposes where the
///         DEX call would slot in.
contract SovereignFund {
    enum Action {
        HOLD,
        BUY_WETH,
        SELL_WETH
    }

    /// @notice The SHIP agent's EVM-mapped address. Only this address can write.
    address public immutable agent;

    /// @notice USDC and WETH tokens the fund holds. Set at construction.
    IERC20 public immutable usdc;
    IERC20 public immutable weth;

    string public description;

    struct Tick {
        Action action;
        uint256 sizeUsd;          // USD-equivalent size of the trade; 0 for HOLD
        uint256 priceUsd;         // WETH/USDC mid-price at tick time, scaled by 1e8
        uint256 usdcAfter;        // USDC balance after execution (snapshot)
        uint256 wethAfter;        // WETH balance after execution (snapshot, scaled by 1e18)
        bytes32 reasonHash;       // keccak256 of the agent's reasoning blob
        uint256 timestamp;
    }

    /// @notice Append-only tick history.
    Tick[] public ticks;

    event Ticked(
        uint256 indexed tickIndex,
        Action indexed action,
        uint256 sizeUsd,
        uint256 priceUsd,
        uint256 usdcAfter,
        uint256 wethAfter,
        bytes32 reasonHash
    );

    error NotAgent();
    error InvalidAction();
    error InsufficientBalance();
    error InvalidPrice();

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(
        address agent_,
        IERC20 usdc_,
        IERC20 weth_,
        string memory description_
    ) {
        agent = agent_;
        usdc = usdc_;
        weth = weth_;
        description = description_;
    }

    /// @notice Called by the SHIP agent on its own schedule. Records the
    ///         agent's decision, applies mocked execution to the contract's
    ///         token balances at the given price, and appends to history.
    /// @param action HOLD, BUY_WETH, or SELL_WETH.
    /// @param sizeUsd USD-equivalent size of the trade. Must be 0 if HOLD.
    /// @param priceUsd WETH/USDC mid-price, scaled by 1e8.
    /// @param reasonHash keccak256 of the agent's reasoning blob.
    function tick(
        Action action,
        uint256 sizeUsd,
        uint256 priceUsd,
        bytes32 reasonHash
    ) external onlyAgent {
        if (priceUsd == 0) revert InvalidPrice();
        if (action == Action.HOLD && sizeUsd != 0) revert InvalidAction();

        // Mocked execution. A production wiring would call a DEX router
        // here and accept actualOut/actualIn from the swap result.
        if (action == Action.BUY_WETH) {
            uint256 spend = sizeUsd * 1e6; // USDC has 6 decimals
            if (usdc.balanceOf(address(this)) < spend) revert InsufficientBalance();
            usdc.transfer(address(0xdEaD), spend);
            // wethOut = sizeUsd / price (where price is scaled 1e8)
            uint256 wethOut = (sizeUsd * 1e8 * 1e18) / priceUsd / 1e0;
            // In a real wiring this would be the actual swap output. For
            // the demo, the agent picks a fair price (the same one it sees)
            // and we materialize WETH from thin air. Replace with router call.
            _mintMockWeth(wethOut);
        } else if (action == Action.SELL_WETH) {
            uint256 wethIn = (sizeUsd * 1e8 * 1e18) / priceUsd;
            if (weth.balanceOf(address(this)) < wethIn) revert InsufficientBalance();
            weth.transfer(address(0xdEaD), wethIn);
            uint256 usdcOut = sizeUsd * 1e6;
            _mintMockUsdc(usdcOut);
        }

        uint256 idx = ticks.length;
        ticks.push(
            Tick({
                action: action,
                sizeUsd: sizeUsd,
                priceUsd: priceUsd,
                usdcAfter: usdc.balanceOf(address(this)),
                wethAfter: weth.balanceOf(address(this)),
                reasonHash: reasonHash,
                timestamp: block.timestamp
            })
        );
        emit Ticked(
            idx,
            action,
            sizeUsd,
            priceUsd,
            usdc.balanceOf(address(this)),
            weth.balanceOf(address(this)),
            reasonHash
        );
    }

    /// @notice Latest tick. Reverts if no ticks have happened yet.
    function latestTick() external view returns (Tick memory) {
        require(ticks.length > 0, "no ticks yet");
        return ticks[ticks.length - 1];
    }

    /// @notice Number of ticks recorded since deployment.
    function tickCount() external view returns (uint256) {
        return ticks.length;
    }

    /// @notice Current portfolio NAV in USD-equivalent at the given price.
    /// @param priceUsd WETH/USDC mid-price, scaled by 1e8.
    function navUsd(uint256 priceUsd) external view returns (uint256) {
        uint256 u = usdc.balanceOf(address(this)) / 1e6;
        uint256 w = (weth.balanceOf(address(this)) * priceUsd) / 1e8 / 1e18;
        return u + w;
    }

    // ---------------------------------------------------------------
    // Mocked execution hooks. In production these would be replaced by
    // the DEX router call. They're internal and only reachable from
    // tick(), which is onlyAgent, so they don't add any attack surface.
    // ---------------------------------------------------------------

    // Test environments hook into these via mock ERC20s with mint().
    // We don't enforce a mint interface here; a real ERC20 would simply
    // not implement them and tick() would revert during execution.
    function _mintMockWeth(uint256 amount) internal {
        (bool ok, ) = address(weth).call(
            abi.encodeWithSignature("mint(address,uint256)", address(this), amount)
        );
        if (!ok) revert InsufficientBalance();
    }

    function _mintMockUsdc(uint256 amount) internal {
        (bool ok, ) = address(usdc).call(
            abi.encodeWithSignature("mint(address,uint256)", address(this), amount)
        );
        if (!ok) revert InsufficientBalance();
    }
}
