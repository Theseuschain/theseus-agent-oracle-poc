// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/BridgeGuardian.sol";

/// @notice Deploys the BridgeGuardian commitment surface.
/// @dev    The agent's EVM-mapped address is read from $AGENT_EVM_ADDRESS.
contract DeployBridgeGuardian is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        BridgeGuardian guardian = new BridgeGuardian(
            agent,
            "Cross-chain bridge release guardian (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("BridgeGuardian:", address(guardian));
        console.log("Writer agent  :", agent);

        vm.writeFile("./deployments/BridgeGuardian.txt", vm.toString(address(guardian)));
    }
}
