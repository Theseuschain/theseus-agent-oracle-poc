// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Test.sol";
import "../src/TerraFailsafe.sol";

contract TerraFailsafeTest is Test {
    TerraFailsafe internal gate;
    address internal agent = address(0xA9E47);
    address internal stranger = address(0xBAD);

    function setUp() public {
        gate = new TerraFailsafe(agent, "test");
    }

    function test_OnlyAgentCanWrite() public {
        vm.prank(stranger);
        vm.expectRevert(TerraFailsafe.NotAgent.selector);
        gate.reportAllow(TerraFailsafe.Action.MINT, bytes32(0));

        vm.prank(stranger);
        vm.expectRevert(TerraFailsafe.NotAgent.selector);
        gate.reportRefuse(TerraFailsafe.Action.MINT, bytes32(0));
    }

    function test_CheckAllowedRevertsBeforeAnyVerdict() public {
        vm.expectRevert(abi.encodeWithSelector(TerraFailsafe.StaleRound.selector, TerraFailsafe.Action.MINT));
        gate.checkAllowed(TerraFailsafe.Action.MINT);
    }

    function test_AllowThenCheckPasses() public {
        bytes32 reason = keccak256("metrics steady");
        vm.prank(agent);
        gate.reportAllow(TerraFailsafe.Action.MINT, reason);
        gate.checkAllowed(TerraFailsafe.Action.MINT);
        assertEq(uint8(gate.latestDecision(TerraFailsafe.Action.MINT)), uint8(TerraFailsafe.Decision.ALLOW));
    }

    function test_RefuseRevertsWithReasonHash() public {
        bytes32 reason = keccak256("redemption pressure spiking");
        vm.prank(agent);
        gate.reportRefuse(TerraFailsafe.Action.REDEEM, reason);

        vm.expectRevert(
            abi.encodeWithSelector(
                TerraFailsafe.ActionRefused.selector,
                TerraFailsafe.Action.REDEEM,
                reason
            )
        );
        gate.checkAllowed(TerraFailsafe.Action.REDEEM);
    }

    function test_PerActionDecisionsAreIndependent() public {
        vm.startPrank(agent);
        gate.reportAllow(TerraFailsafe.Action.MINT, keccak256("ok"));
        gate.reportRefuse(TerraFailsafe.Action.REDEEM, keccak256("danger"));
        vm.stopPrank();

        gate.checkAllowed(TerraFailsafe.Action.MINT);
        vm.expectRevert();
        gate.checkAllowed(TerraFailsafe.Action.REDEEM);
    }

    function test_RoundIdsMonotonicPerAction() public {
        vm.startPrank(agent);
        gate.reportAllow(TerraFailsafe.Action.MINT, bytes32(uint256(1)));
        gate.reportRefuse(TerraFailsafe.Action.MINT, bytes32(uint256(2)));
        gate.reportAllow(TerraFailsafe.Action.MINT, bytes32(uint256(3)));
        vm.stopPrank();
        assertEq(gate.latestRoundId(TerraFailsafe.Action.MINT), 3);
    }
}
