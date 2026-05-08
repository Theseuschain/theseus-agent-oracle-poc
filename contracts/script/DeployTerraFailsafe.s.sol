// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/TerraFailsafe.sol";

/// @notice Deploys the TerraFailsafe gate.
/// @dev    The agent's EVM-mapped address is read from $AGENT_EVM_ADDRESS.
///         Mirrors DeployFeed.s.sol's env contract.
contract DeployTerraFailsafe is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        TerraFailsafe gate = new TerraFailsafe(
            agent,
            "USTD/LUND mint+redeem failsafe (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("TerraFailsafe :", address(gate));
        console.log("Writer agent  :", agent);

        vm.writeFile("./deployments/TerraFailsafe.txt", vm.toString(address(gate)));
    }
}
