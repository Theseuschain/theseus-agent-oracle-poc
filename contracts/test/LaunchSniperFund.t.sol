// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/LaunchSniperFund.sol";

contract LaunchSniperFundTest is Test {
    LaunchSniperFund internal fund;

    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);
    address internal tokenA = address(0xA1);
    address internal tokenB = address(0xB2);

    uint256 internal constant STARTING_USDC = 10_000 * 1e6; // 10k virtual USDC

    function setUp() public {
        fund = new LaunchSniperFund(agent, STARTING_USDC, "test");
    }

    function test_OnlyAgentCanTick() public {
        vm.prank(stranger);
        vm.expectRevert(LaunchSniperFund.NotAgent.selector);
        fund.tick(LaunchSniperFund.Action.HOLD, address(0), 0, 0, bytes32(0));
    }

    function test_StartingPaperUsdc() public {
        assertEq(fund.paperUsdc(), STARTING_USDC);
        assertEq(fund.startingUsdc(), STARTING_USDC);
        assertEq(fund.tickCount(), 0);
    }

    function test_HoldHeartbeat() public {
        vm.prank(agent);
        fund.tick(LaunchSniperFund.Action.HOLD, address(0), 0, 0, keccak256("heartbeat"));

        assertEq(fund.tickCount(), 1);
        LaunchSniperFund.Tick memory t = fund.latestTick();
        assertEq(uint8(t.action), uint8(LaunchSniperFund.Action.HOLD));
        assertEq(t.token, address(0));
        assertEq(t.paperUsdcAfter, STARTING_USDC);
    }

    function test_HoldWithTokenReverts() public {
        vm.prank(agent);
        vm.expectRevert(LaunchSniperFund.InvalidAction.selector);
        fund.tick(LaunchSniperFund.Action.HOLD, tokenA, 0, 0, bytes32(0));
    }

    function test_HoldWithAmountReverts() public {
        vm.prank(agent);
        vm.expectRevert(LaunchSniperFund.InvalidAction.selector);
        fund.tick(LaunchSniperFund.Action.HOLD, address(0), 0, 1, bytes32(0));
    }

    function test_PassRecordsTokenWithoutMovingMoney() public {
        vm.prank(agent);
        fund.tick(LaunchSniperFund.Action.PASS, tokenA, 0, 0, keccak256("looks like a honeypot"));

        assertEq(fund.tickCount(), 1);
        assertEq(fund.tokenCount(), 1);
        assertEq(fund.tokens(0), tokenA);
        assertEq(fund.paperUsdc(), STARTING_USDC); // unchanged
        (uint256 amt, uint256 cost, uint256 proceeds, bool open) = fund.positions(tokenA);
        assertEq(amt, 0);
        assertEq(cost, 0);
        assertEq(proceeds, 0);
        assertEq(open, false);
    }

    function test_PassWithZeroTokenReverts() public {
        vm.prank(agent);
        vm.expectRevert(LaunchSniperFund.InvalidAction.selector);
        fund.tick(LaunchSniperFund.Action.PASS, address(0), 0, 0, bytes32(0));
    }

    function test_PassWithAmountReverts() public {
        vm.prank(agent);
        vm.expectRevert(LaunchSniperFund.InvalidAction.selector);
        fund.tick(LaunchSniperFund.Action.PASS, tokenA, 1, 0, bytes32(0));
    }

    function test_BuyTokenDecreasesUsdcIncreasesPosition() public {
        // Paper-buy 1,000,000 tokenA for 100 USDC.
        uint256 spendUsdc = 100 * 1e6;
        uint256 gainToken = 1_000_000 * 1e18;

        vm.prank(agent);
        fund.tick(
            LaunchSniperFund.Action.BUY_TOKEN,
            tokenA,
            gainToken,
            spendUsdc,
            keccak256("fresh launch, ownership renounced, deployer has clean history")
        );

        assertEq(fund.paperUsdc(), STARTING_USDC - spendUsdc);
        (uint256 amt, uint256 cost, uint256 proceeds, bool open) = fund.positions(tokenA);
        assertEq(amt, gainToken);
        assertEq(cost, spendUsdc);
        assertEq(proceeds, 0);
        assertEq(open, true);
        assertEq(fund.tokenCount(), 1);
    }

    function test_BuyTokenPastBalanceReverts() public {
        vm.prank(agent);
        vm.expectRevert(LaunchSniperFund.InsufficientPaperUsdc.selector);
        fund.tick(
            LaunchSniperFund.Action.BUY_TOKEN,
            tokenA,
            1,
            STARTING_USDC + 1,
            bytes32(0)
        );
    }

    function test_BuyTokenWithZeroAmountReverts() public {
        vm.prank(agent);
        vm.expectRevert(LaunchSniperFund.InvalidAction.selector);
        fund.tick(
            LaunchSniperFund.Action.BUY_TOKEN,
            tokenA,
            0,
            100 * 1e6,
            bytes32(0)
        );
    }

    function test_SellTokenIncreasesUsdcDecreasesPosition() public {
        // Buy then sell half at a 5x.
        vm.startPrank(agent);
        fund.tick(
            LaunchSniperFund.Action.BUY_TOKEN,
            tokenA,
            1_000_000 * 1e18,
            100 * 1e6,
            keccak256("entry")
        );
        fund.tick(
            LaunchSniperFund.Action.SELL_TOKEN,
            tokenA,
            500_000 * 1e18,
            250 * 1e6, // 5x on half the position
            keccak256("scaling out")
        );
        vm.stopPrank();

        assertEq(fund.paperUsdc(), STARTING_USDC - 100 * 1e6 + 250 * 1e6);
        (uint256 amt, uint256 cost, uint256 proceeds, bool open) = fund.positions(tokenA);
        assertEq(amt, 500_000 * 1e18);
        assertEq(cost, 100 * 1e6);
        assertEq(proceeds, 250 * 1e6);
        assertEq(open, true);
    }

    function test_FullSellClosesPosition() public {
        vm.startPrank(agent);
        fund.tick(
            LaunchSniperFund.Action.BUY_TOKEN,
            tokenA,
            1_000_000 * 1e18,
            100 * 1e6,
            bytes32(0)
        );
        fund.tick(
            LaunchSniperFund.Action.SELL_TOKEN,
            tokenA,
            1_000_000 * 1e18,
            10 * 1e6, // exit at a loss
            bytes32(0)
        );
        vm.stopPrank();

        (uint256 amt, , , bool open) = fund.positions(tokenA);
        assertEq(amt, 0);
        assertEq(open, false);
    }

    function test_SellMoreThanHeldReverts() public {
        vm.startPrank(agent);
        fund.tick(
            LaunchSniperFund.Action.BUY_TOKEN,
            tokenA,
            1_000 * 1e18,
            10 * 1e6,
            bytes32(0)
        );
        vm.expectRevert(LaunchSniperFund.InsufficientPosition.selector);
        fund.tick(
            LaunchSniperFund.Action.SELL_TOKEN,
            tokenA,
            10_000 * 1e18,
            100 * 1e6,
            bytes32(0)
        );
        vm.stopPrank();
    }

    function test_TokensListDeduplicates() public {
        vm.startPrank(agent);
        fund.tick(LaunchSniperFund.Action.PASS, tokenA, 0, 0, bytes32(0));
        fund.tick(LaunchSniperFund.Action.PASS, tokenA, 0, 0, bytes32(0));
        fund.tick(LaunchSniperFund.Action.BUY_TOKEN, tokenA, 1, 1, bytes32(0));
        fund.tick(LaunchSniperFund.Action.PASS, tokenB, 0, 0, bytes32(0));
        vm.stopPrank();

        assertEq(fund.tokenCount(), 2);
        assertEq(fund.tokens(0), tokenA);
        assertEq(fund.tokens(1), tokenB);
    }

    function test_TickHistoryIsAppendOnly() public {
        vm.startPrank(agent);
        fund.tick(LaunchSniperFund.Action.HOLD, address(0), 0, 0, keccak256("t1"));
        fund.tick(LaunchSniperFund.Action.PASS, tokenA, 0, 0, keccak256("t2"));
        fund.tick(LaunchSniperFund.Action.BUY_TOKEN, tokenB, 100, 10, keccak256("t3"));
        fund.tick(LaunchSniperFund.Action.SELL_TOKEN, tokenB, 50, 30, keccak256("t4"));
        vm.stopPrank();

        assertEq(fund.tickCount(), 4);
    }
}
