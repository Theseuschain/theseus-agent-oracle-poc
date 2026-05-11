// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/AviationSafetyReviewer.sol";

contract AviationSafetyReviewerTest is Test {
    AviationSafetyReviewer internal reviewer;
    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);

    function setUp() public {
        reviewer = new AviationSafetyReviewer(agent, "test");
    }

    function test_OnlyAgentCanWrite() public {
        vm.prank(stranger);
        vm.expectRevert(AviationSafetyReviewer.NotAgent.selector);
        reviewer.review(1, AviationSafetyReviewer.Decision.APPROVE, bytes32(0));
    }

    function test_UninitializedIsNotAValidWrite() public {
        vm.prank(agent);
        vm.expectRevert(AviationSafetyReviewer.InvalidDecision.selector);
        reviewer.review(1, AviationSafetyReviewer.Decision.UNINITIALIZED, bytes32(0));
    }

    function test_ApproveStoresVerdict() public {
        bytes32 reason = keccak256("aerodynamic only, no controls or sensors");
        vm.prank(agent);
        reviewer.review(2401, AviationSafetyReviewer.Decision.APPROVE, reason);

        (AviationSafetyReviewer.Decision d, , bytes32 stored) =
            reviewer.getVerdict(2401);
        assertEq(uint8(d), uint8(AviationSafetyReviewer.Decision.APPROVE));
        assertEq(stored, reason);
        assertTrue(reviewer.isApproved(2401));
        assertFalse(reviewer.isRejected(2401));
    }

    function test_RejectStoresVerdictWithoutReverting() public {
        // Like the governance reviewer, REJECT does not cause getVerdict
        // to revert. The verdict is advisory; downstream reads freely.
        bytes32 reason = keccak256("single-sensor flight-control trigger; MCAS shape");
        vm.prank(agent);
        reviewer.review(2403, AviationSafetyReviewer.Decision.REJECT, reason);

        (AviationSafetyReviewer.Decision d, , ) = reviewer.getVerdict(2403);
        assertEq(uint8(d), uint8(AviationSafetyReviewer.Decision.REJECT));
        assertTrue(reviewer.isRejected(2403));
        assertFalse(reviewer.isApproved(2403));
    }

    function test_CautionIsDistinctFromBothApproveAndReject() public {
        vm.prank(agent);
        reviewer.review(
            2402,
            AviationSafetyReviewer.Decision.CAUTION,
            keccak256("training-class mismatch")
        );
        assertFalse(reviewer.isApproved(2402));
        assertFalse(reviewer.isRejected(2402));
    }

    function test_VerdictsCanBeUpdated() public {
        vm.startPrank(agent);
        reviewer.review(2405, AviationSafetyReviewer.Decision.CAUTION, keccak256("first pass"));
        reviewer.review(2405, AviationSafetyReviewer.Decision.REJECT, keccak256("more context"));
        vm.stopPrank();

        (AviationSafetyReviewer.Decision d, , ) = reviewer.getVerdict(2405);
        assertEq(uint8(d), uint8(AviationSafetyReviewer.Decision.REJECT));
    }

    function test_TouchedChangeCount() public {
        vm.startPrank(agent);
        reviewer.review(1, AviationSafetyReviewer.Decision.APPROVE, bytes32(uint256(1)));
        reviewer.review(2, AviationSafetyReviewer.Decision.CAUTION, bytes32(uint256(2)));
        reviewer.review(1, AviationSafetyReviewer.Decision.REJECT, bytes32(uint256(3))); // re-touch
        vm.stopPrank();
        assertEq(reviewer.touchedChangeCount(), 2);
    }
}
