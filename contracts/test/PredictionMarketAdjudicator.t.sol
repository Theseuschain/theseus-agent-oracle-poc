// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/PredictionMarketAdjudicator.sol";

contract PredictionMarketAdjudicatorTest is Test {
    PredictionMarketAdjudicator internal adj;
    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);

    function setUp() public {
        adj = new PredictionMarketAdjudicator(agent, "test");
    }

    function test_OnlyAgentCanWrite() public {
        vm.prank(stranger);
        vm.expectRevert(PredictionMarketAdjudicator.NotAgent.selector);
        adj.resolve(1001, 2, 0, 90, bytes32(0));

        vm.prank(stranger);
        vm.expectRevert(PredictionMarketAdjudicator.NotAgent.selector);
        adj.refuse(1001, bytes32(0));
    }

    function test_GetVerdictRevertsBeforeResolution() public {
        vm.expectRevert(
            abi.encodeWithSelector(PredictionMarketAdjudicator.MarketUnresolved.selector, 1001)
        );
        adj.getVerdict(1001);
    }

    function test_ResolveStoresVerdict() public {
        bytes32 reason = keccak256("GPT-5 launched on openai.com on 2025-08-07");
        vm.prank(agent);
        adj.resolve(1001, 2, 0, 98, reason);

        (uint8 winning, uint8 conf, , bytes32 storedReason) = adj.getVerdict(1001);
        assertEq(winning, 0);
        assertEq(conf, 98);
        assertEq(storedReason, reason);
        assertTrue(adj.isResolved(1001));
        assertEq(adj.touchedMarketCount(), 1);
    }

    function test_RefuseDoesNotLockMarket() public {
        bytes32 r1 = keccak256("deadline ahead");
        vm.prank(agent);
        adj.refuse(1002, r1);

        // refused -> getVerdict reverts
        vm.expectRevert(
            abi.encodeWithSelector(
                PredictionMarketAdjudicator.MarketRefused.selector, 1002, r1
            )
        );
        adj.getVerdict(1002);

        // ...but agent can come back later and resolve it
        bytes32 r2 = keccak256("deadline passed; nothing shipped");
        vm.prank(agent);
        adj.resolve(1002, 2, 1, 92, r2);

        (uint8 winning, uint8 conf, , ) = adj.getVerdict(1002);
        assertEq(winning, 1);
        assertEq(conf, 92);
        // touchedMarkets should not double-count
        assertEq(adj.touchedMarketCount(), 1);
    }

    function test_ResolvedIsTerminal() public {
        vm.startPrank(agent);
        adj.resolve(1003, 2, 0, 85, keccak256("first call"));
        vm.expectRevert(
            abi.encodeWithSelector(PredictionMarketAdjudicator.AlreadyResolved.selector, 1003)
        );
        adj.resolve(1003, 2, 1, 90, keccak256("second call"));

        vm.expectRevert(
            abi.encodeWithSelector(PredictionMarketAdjudicator.AlreadyResolved.selector, 1003)
        );
        adj.refuse(1003, keccak256("change of mind"));
        vm.stopPrank();
    }

    function test_RejectsOutOfRangeWinningOption() public {
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(PredictionMarketAdjudicator.InvalidWinningOption.selector, 5, 2)
        );
        adj.resolve(1004, 2, 5, 90, bytes32(0));
    }

    function test_RejectsOutOfRangeConfidence() public {
        vm.prank(agent);
        vm.expectRevert(
            abi.encodeWithSelector(PredictionMarketAdjudicator.InvalidConfidence.selector, 101)
        );
        adj.resolve(1005, 2, 0, 101, bytes32(0));
    }

    function test_InspectReturnsRawDecision() public {
        vm.prank(agent);
        adj.refuse(1006, keccak256("ambiguous"));
        PredictionMarketAdjudicator.Verdict memory v = adj.inspect(1006);
        assertEq(uint8(v.decision), uint8(PredictionMarketAdjudicator.Decision.REFUSED));
    }
}
