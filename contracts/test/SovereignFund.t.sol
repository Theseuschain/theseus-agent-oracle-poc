// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/SovereignFund.sol";

/// @notice Minimal ERC20 used for both USDC and WETH in tests.
contract MintableERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount)
        external
        returns (bool)
    {
        require(balanceOf[from] >= amount, "insufficient");
        if (allowance[from][msg.sender] != type(uint256).max) {
            require(allowance[from][msg.sender] >= amount, "no allowance");
            allowance[from][msg.sender] -= amount;
        }
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
}

/// @notice Mock Uniswap V3 SwapRouter. Holds a price (scaled by 1e8) and
///         executes deterministic swaps at that price. Real testnet
///         deployments substitute the actual Uniswap V3 router.
contract MockSwapRouter is ISwapRouter {
    /// @notice WETH/USDC mid price, scaled by 1e8. E.g. 2500 * 1e8.
    uint256 public price;
    IERC20 public immutable usdc;
    IERC20 public immutable weth;

    constructor(uint256 price_, IERC20 usdc_, IERC20 weth_) {
        price = price_;
        usdc = usdc_;
        weth = weth_;
    }

    function setPrice(uint256 newPrice) external {
        price = newPrice;
    }

    function exactInputSingle(ExactInputSingleParams calldata p)
        external
        payable
        override
        returns (uint256 amountOut)
    {
        // Pull tokens in from the caller.
        IERC20(p.tokenIn).transferFrom(msg.sender, address(this), p.amountIn);

        // Compute amountOut based on the configured price.
        //   BUY_WETH:  amountIn USDC (6 dec) -> amountOut WETH (18 dec)
        //              wethOut = amountIn * 1e8 * 1e12 / price
        //   SELL_WETH: amountIn WETH (18 dec) -> amountOut USDC (6 dec)
        //              usdcOut = amountIn * price / 1e8 / 1e12
        if (p.tokenIn == address(usdc) && p.tokenOut == address(weth)) {
            amountOut = (p.amountIn * 1e8 * 1e12) / price;
        } else if (p.tokenIn == address(weth) && p.tokenOut == address(usdc)) {
            amountOut = (p.amountIn * price) / 1e8 / 1e12;
        } else {
            revert("unsupported pair");
        }

        require(amountOut >= p.amountOutMinimum, "slippage");

        // Mint output to the recipient. A real router would have a pool
        // with real liquidity; here we just mint.
        (bool ok, ) = address(p.tokenOut).call(
            abi.encodeWithSignature("mint(address,uint256)", p.recipient, amountOut)
        );
        require(ok, "mint failed");
    }
}

contract SovereignFundTest is Test {
    SovereignFund internal fund;
    MintableERC20 internal usdc;
    MintableERC20 internal weth;
    MockSwapRouter internal router;

    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);

    uint256 internal constant PRICE = 2_500 * 1e8; // $2,500 scaled by 1e8
    uint24 internal constant POOL_FEE = 500;       // 0.05% tier

    function setUp() public {
        usdc = new MintableERC20();
        weth = new MintableERC20();
        router = new MockSwapRouter(PRICE, IERC20(address(usdc)), IERC20(address(weth)));
        fund = new SovereignFund(
            agent,
            IERC20(address(usdc)),
            IERC20(address(weth)),
            ISwapRouter(address(router)),
            POOL_FEE,
            "test"
        );

        // Seed the fund with 500k USDC + 200 WETH (50-50 at $2,500).
        usdc.mint(address(fund), 500_000 * 1e6);
        weth.mint(address(fund), 200 * 1e18);
    }

    function test_OnlyAgentCanTick() public {
        vm.prank(stranger);
        vm.expectRevert(SovereignFund.NotAgent.selector);
        fund.tick(SovereignFund.Action.HOLD, 0, 0, block.timestamp, bytes32(0));
    }

    function test_HoldRecordsTickWithoutMoving() public {
        vm.prank(agent);
        fund.tick(SovereignFund.Action.HOLD, 0, 0, block.timestamp, keccak256("calm"));

        assertEq(fund.tickCount(), 1);
        SovereignFund.Tick memory t = fund.latestTick();
        assertEq(uint8(t.action), uint8(SovereignFund.Action.HOLD));
        assertEq(t.amountIn, 0);
        assertEq(t.amountOut, 0);
        assertEq(t.usdcAfter, 500_000 * 1e6);
        assertEq(t.wethAfter, 200 * 1e18);
    }

    function test_HoldWithSizeReverts() public {
        vm.prank(agent);
        vm.expectRevert(SovereignFund.InvalidAction.selector);
        fund.tick(
            SovereignFund.Action.HOLD,
            1_000,
            0,
            block.timestamp,
            bytes32(0)
        );
    }

    function test_NonHoldWithZeroSizeReverts() public {
        vm.prank(agent);
        vm.expectRevert(SovereignFund.InvalidAction.selector);
        fund.tick(
            SovereignFund.Action.BUY_WETH,
            0,
            0,
            block.timestamp,
            bytes32(0)
        );
    }

    function test_BuyWethSwapsThroughRouter() public {
        // Buy $100k of WETH at $2,500. amountIn = 100k USDC; expected
        // amountOut = 40 WETH.
        uint256 amountIn = 100_000 * 1e6;
        uint256 expectedOut = 40 * 1e18;

        vm.prank(agent);
        fund.tick(
            SovereignFund.Action.BUY_WETH,
            amountIn,
            expectedOut, // exact match, zero slippage budget for the test
            block.timestamp,
            keccak256("trend tilt")
        );

        SovereignFund.Tick memory t = fund.latestTick();
        assertEq(t.amountIn, amountIn);
        assertEq(t.amountOut, expectedOut);
        assertEq(t.usdcAfter, 400_000 * 1e6); // 500k - 100k
        assertEq(t.wethAfter, 240 * 1e18);    // 200 + 40
    }

    function test_SellWethSwapsThroughRouter() public {
        // Sell 80 WETH at $2,500. amountIn = 80 WETH; expected
        // amountOut = 200k USDC.
        uint256 amountIn = 80 * 1e18;
        uint256 expectedOut = 200_000 * 1e6;

        vm.prank(agent);
        fund.tick(
            SovereignFund.Action.SELL_WETH,
            amountIn,
            expectedOut,
            block.timestamp,
            keccak256("regime change")
        );

        SovereignFund.Tick memory t = fund.latestTick();
        assertEq(t.amountIn, amountIn);
        assertEq(t.amountOut, expectedOut);
        assertEq(t.usdcAfter, 700_000 * 1e6); // 500k + 200k
        assertEq(t.wethAfter, 120 * 1e18);    // 200 - 80
    }

    function test_SlippageProtectionRevertsWhenRouterReturnsLess() public {
        // Force the router to drop the price between agent decision and
        // execution (real-world: the pool moves before our tx lands).
        router.setPrice(2_000 * 1e8);

        uint256 amountIn = 100_000 * 1e6;
        // Agent expected 40 WETH at $2,500 with no slippage budget.
        uint256 minOut = 40 * 1e18;

        vm.prank(agent);
        // Router returns 50 WETH at the new $2k price, which actually
        // EXCEEDS minOut here. Let's flip to demonstrate the revert path
        // properly: ask for an amount the router can't satisfy.
        vm.expectRevert(); // "slippage" from the mock router
        fund.tick(
            SovereignFund.Action.SELL_WETH,
            10 * 1e18,
            100_000 * 1e6, // demand $100k from selling 10 WETH; pool will give $20k
            block.timestamp,
            bytes32(0)
        );
    }

    function test_TickHistoryIsAppendOnly() public {
        vm.startPrank(agent);
        fund.tick(SovereignFund.Action.HOLD, 0, 0, block.timestamp, keccak256("t1"));
        fund.tick(
            SovereignFund.Action.BUY_WETH,
            50_000 * 1e6,
            20 * 1e18,
            block.timestamp,
            keccak256("t2")
        );
        fund.tick(
            SovereignFund.Action.SELL_WETH,
            10 * 1e18,
            25_000 * 1e6,
            block.timestamp,
            keccak256("t3")
        );
        vm.stopPrank();
        assertEq(fund.tickCount(), 3);
    }

    function test_WithdrawIsAgentOnly() public {
        vm.prank(stranger);
        vm.expectRevert(SovereignFund.NotAgent.selector);
        fund.withdraw(IERC20(address(usdc)), stranger, 1);

        vm.prank(agent);
        fund.withdraw(IERC20(address(usdc)), agent, 1_000 * 1e6);
        assertEq(usdc.balanceOf(agent), 1_000 * 1e6);
    }
}
