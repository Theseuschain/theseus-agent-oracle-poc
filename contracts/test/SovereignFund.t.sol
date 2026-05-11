// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/SovereignFund.sol";

contract MintableERC20 {
    mapping(address => uint256) public balanceOf;

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
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }
}

contract SovereignFundTest is Test {
    SovereignFund internal fund;
    MintableERC20 internal usdc;
    MintableERC20 internal weth;

    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);

    uint256 internal constant PRICE = 2_500 * 1e8; // $2,500 scaled by 1e8

    function setUp() public {
        usdc = new MintableERC20();
        weth = new MintableERC20();
        fund = new SovereignFund(agent, IERC20(address(usdc)), IERC20(address(weth)), "test");

        // Seed the fund with 500k USDC + 200 WETH (50-50 by USD at $2,500).
        usdc.mint(address(fund), 500_000 * 1e6);
        weth.mint(address(fund), 200 * 1e18);
    }

    function test_OnlyAgentCanWrite() public {
        vm.prank(stranger);
        vm.expectRevert(SovereignFund.NotAgent.selector);
        fund.tick(SovereignFund.Action.HOLD, 0, PRICE, bytes32(0));
    }

    function test_HoldRecordsTickWithoutMoving() public {
        vm.prank(agent);
        fund.tick(SovereignFund.Action.HOLD, 0, PRICE, keccak256("calm market"));

        assertEq(fund.tickCount(), 1);
        SovereignFund.Tick memory t = fund.latestTick();
        assertEq(uint8(t.action), uint8(SovereignFund.Action.HOLD));
        assertEq(t.sizeUsd, 0);
        assertEq(t.usdcAfter, 500_000 * 1e6);
        assertEq(t.wethAfter, 200 * 1e18);
    }

    function test_HoldRefusesSize() public {
        vm.prank(agent);
        vm.expectRevert(SovereignFund.InvalidAction.selector);
        fund.tick(SovereignFund.Action.HOLD, 1_000, PRICE, bytes32(0));
    }

    function test_BuyWethReducesUsdcAndIncreasesWeth() public {
        // Buy $100k of WETH at $2,500 = 40 WETH
        vm.prank(agent);
        fund.tick(
            SovereignFund.Action.BUY_WETH,
            100_000,
            PRICE,
            keccak256("trend tilt")
        );

        SovereignFund.Tick memory t = fund.latestTick();
        assertEq(t.usdcAfter, 400_000 * 1e6);
        assertEq(t.wethAfter, 240 * 1e18); // 200 + 40
    }

    function test_SellWethIncreasesUsdcAndReducesWeth() public {
        // Sell $200k of WETH at $2,500 = 80 WETH
        vm.prank(agent);
        fund.tick(
            SovereignFund.Action.SELL_WETH,
            200_000,
            PRICE,
            keccak256("regime change")
        );

        SovereignFund.Tick memory t = fund.latestTick();
        assertEq(t.usdcAfter, 700_000 * 1e6);
        assertEq(t.wethAfter, 120 * 1e18); // 200 - 80
    }

    function test_PriceZeroReverts() public {
        vm.prank(agent);
        vm.expectRevert(SovereignFund.InvalidPrice.selector);
        fund.tick(SovereignFund.Action.HOLD, 0, 0, bytes32(0));
    }

    function test_NavUsdReflectsBalances() public view {
        // 500k USDC + 200 WETH at $2,500 = $500k + $500k = $1M
        uint256 nav = fund.navUsd(PRICE);
        assertEq(nav, 1_000_000);
    }

    function test_TickHistoryIsAppendOnly() public {
        vm.startPrank(agent);
        fund.tick(SovereignFund.Action.HOLD, 0, PRICE, keccak256("t1"));
        fund.tick(SovereignFund.Action.BUY_WETH, 50_000, PRICE, keccak256("t2"));
        fund.tick(SovereignFund.Action.SELL_WETH, 20_000, PRICE, keccak256("t3"));
        vm.stopPrank();
        assertEq(fund.tickCount(), 3);
    }
}
