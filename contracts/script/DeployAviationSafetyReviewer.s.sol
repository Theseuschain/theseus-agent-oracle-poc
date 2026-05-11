// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/AviationSafetyReviewer.sol";

/// @notice Deploys the AviationSafetyReviewer commitment surface.
/// @dev    The agent's EVM-mapped address is read from $AGENT_EVM_ADDRESS.
contract DeployAviationSafetyReviewer is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        AviationSafetyReviewer reviewer = new AviationSafetyReviewer(
            agent,
            "Aircraft type-certification reviewer (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("AviationSafetyReviewer:", address(reviewer));
        console.log("Writer agent          :", agent);

        vm.writeFile(
            "./deployments/AviationSafetyReviewer.txt",
            vm.toString(address(reviewer))
        );
    }
}
