// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/GovernanceReviewer.sol";

/// @notice Deploys the GovernanceReviewer commitment surface.
/// @dev    The agent's EVM-mapped address is read from $AGENT_EVM_ADDRESS.
contract DeployGovernanceReviewer is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        GovernanceReviewer reviewer = new GovernanceReviewer(
            agent,
            "DAO proposal reviewer (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("GovernanceReviewer:", address(reviewer));
        console.log("Writer agent      :", agent);

        vm.writeFile(
            "./deployments/GovernanceReviewer.txt",
            vm.toString(address(reviewer))
        );
    }
}
