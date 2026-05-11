// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/GovernanceReviewer.sol";

contract GovernanceReviewerTest is Test {
    GovernanceReviewer internal reviewer;
    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);

    function setUp() public {
        reviewer = new GovernanceReviewer(agent, "test");
    }

    function test_OnlyAgentCanWrite() public {
        vm.prank(stranger);
        vm.expectRevert(GovernanceReviewer.NotAgent.selector);
        reviewer.review(1, GovernanceReviewer.Decision.APPROVE, bytes32(0));
    }

    function test_UninitializedIsNotAValidWrite() public {
        vm.prank(agent);
        vm.expectRevert(GovernanceReviewer.InvalidDecision.selector);
        reviewer.review(1, GovernanceReviewer.Decision.UNINITIALIZED, bytes32(0));
    }

    function test_ApproveStoresVerdict() public {
        bytes32 reason = keccak256("routine grants, long-time proposer");
        vm.prank(agent);
        reviewer.review(138, GovernanceReviewer.Decision.APPROVE, reason);

        (GovernanceReviewer.Decision d, , bytes32 stored) = reviewer.getVerdict(138);
        assertEq(uint8(d), uint8(GovernanceReviewer.Decision.APPROVE));
        assertEq(stored, reason);
        assertTrue(reviewer.isApproved(138));
        assertFalse(reviewer.isRejected(138));
    }

    function test_RejectStoresVerdictWithoutReverting() public {
        // Unlike the bridge guardian's REFUSE, REJECT here does NOT cause
        // getVerdict to revert. The verdict is advisory; downstream contracts
        // read it freely and decide what to do.
        bytes32 reason = keccak256("calldata does not match summary; beanstalk shape");
        vm.prank(agent);
        reviewer.review(141, GovernanceReviewer.Decision.REJECT, reason);

        (GovernanceReviewer.Decision d, , ) = reviewer.getVerdict(141);
        assertEq(uint8(d), uint8(GovernanceReviewer.Decision.REJECT));
        assertTrue(reviewer.isRejected(141));
        assertFalse(reviewer.isApproved(141));
    }

    function test_CautionIsDistinctFromBothApproveAndReject() public {
        vm.prank(agent);
        reviewer.review(139, GovernanceReviewer.Decision.CAUTION, keccak256("short window, fresh proposer"));
        assertFalse(reviewer.isApproved(139));
        assertFalse(reviewer.isRejected(139));
    }

    function test_VerdictsCanBeUpdated() public {
        vm.startPrank(agent);
        reviewer.review(140, GovernanceReviewer.Decision.CAUTION, keccak256("first pass"));
        reviewer.review(140, GovernanceReviewer.Decision.REJECT, keccak256("more context, rejecting"));
        vm.stopPrank();

        (GovernanceReviewer.Decision d, , ) = reviewer.getVerdict(140);
        assertEq(uint8(d), uint8(GovernanceReviewer.Decision.REJECT));
    }

    function test_TouchedProposalCount() public {
        vm.startPrank(agent);
        reviewer.review(1, GovernanceReviewer.Decision.APPROVE, bytes32(uint256(1)));
        reviewer.review(2, GovernanceReviewer.Decision.CAUTION, bytes32(uint256(2)));
        reviewer.review(1, GovernanceReviewer.Decision.REJECT, bytes32(uint256(3))); // re-touch
        vm.stopPrank();
        assertEq(reviewer.touchedProposalCount(), 2);
    }

    function test_GetVerdictBeforeReviewReturnsUninitialized() public view {
        (GovernanceReviewer.Decision d, uint256 ts, bytes32 hash_) = reviewer.getVerdict(999);
        assertEq(uint8(d), uint8(GovernanceReviewer.Decision.UNINITIALIZED));
        assertEq(ts, 0);
        assertEq(hash_, bytes32(0));
    }
}
