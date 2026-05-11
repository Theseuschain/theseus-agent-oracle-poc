// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/BridgeGuardian.sol";

contract BridgeGuardianTest is Test {
    BridgeGuardian internal guardian;
    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);

    bytes32 internal constant ROOT_A = keccak256("attestation/a");
    bytes32 internal constant ROOT_B = keccak256("attestation/b");

    function setUp() public {
        guardian = new BridgeGuardian(agent, "test");
    }

    function test_OnlyAgentCanWrite() public {
        vm.prank(stranger);
        vm.expectRevert(BridgeGuardian.NotAgent.selector);
        guardian.reportAllow(ROOT_A, bytes32(0));

        vm.prank(stranger);
        vm.expectRevert(BridgeGuardian.NotAgent.selector);
        guardian.reportRefuse(ROOT_A, bytes32(0));
    }

    function test_CheckAllowedRevertsBeforeAnyVerdict() public {
        vm.expectRevert(
            abi.encodeWithSelector(BridgeGuardian.AttestationUnverified.selector, ROOT_A)
        );
        guardian.checkAllowed(ROOT_A);
    }

    function test_AllowThenCheckPasses() public {
        bytes32 reason = keccak256("validators 9/9, finalized, fresh");
        vm.prank(agent);
        guardian.reportAllow(ROOT_A, reason);
        guardian.checkAllowed(ROOT_A);
        assertTrue(guardian.isAllowed(ROOT_A));
        assertEq(uint8(guardian.latestDecision(ROOT_A)), uint8(BridgeGuardian.Decision.ALLOW));
    }

    function test_RefuseRevertsWithReasonHash() public {
        bytes32 reason = keccak256("validator set just rotated, bare quorum");
        vm.prank(agent);
        guardian.reportRefuse(ROOT_A, reason);

        vm.expectRevert(
            abi.encodeWithSelector(
                BridgeGuardian.AttestationRefused.selector,
                ROOT_A,
                reason
            )
        );
        guardian.checkAllowed(ROOT_A);
        assertFalse(guardian.isAllowed(ROOT_A));
    }

    function test_PerAttestationDecisionsAreIndependent() public {
        vm.startPrank(agent);
        guardian.reportAllow(ROOT_A, keccak256("ok"));
        guardian.reportRefuse(ROOT_B, keccak256("ronin-shape"));
        vm.stopPrank();

        guardian.checkAllowed(ROOT_A);
        vm.expectRevert();
        guardian.checkAllowed(ROOT_B);
    }

    function test_VerdictCanBeOverwritten() public {
        // Unlike PredictionMarketAdjudicator's RESOLVED state, the bridge
        // guardian does not lock attestations. A REFUSE can be revisited if
        // the agent later determines the source-chain state recovered.
        vm.startPrank(agent);
        guardian.reportRefuse(ROOT_A, keccak256("first call"));
        guardian.reportAllow(ROOT_A, keccak256("recovered"));
        vm.stopPrank();
        assertTrue(guardian.isAllowed(ROOT_A));
    }

    function test_TouchedAttestationCount() public {
        vm.startPrank(agent);
        guardian.reportAllow(ROOT_A, bytes32(uint256(1)));
        guardian.reportRefuse(ROOT_B, bytes32(uint256(2)));
        guardian.reportAllow(ROOT_A, bytes32(uint256(3))); // re-touch, no double-count
        vm.stopPrank();
        assertEq(guardian.touchedAttestationCount(), 2);
    }
}
