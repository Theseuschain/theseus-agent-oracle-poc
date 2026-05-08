// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/PredictionMarketAdjudicator.sol";

/// @notice Deploys the PredictionMarketAdjudicator commitment surface.
/// @dev    The agent's EVM-mapped address is read from $AGENT_EVM_ADDRESS.
///         Mirrors DeployFeed.s.sol's env contract.
contract DeployPredictionMarketAdjudicator is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        PredictionMarketAdjudicator adj = new PredictionMarketAdjudicator(
            agent,
            "Prediction market resolver (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("PredictionMarketAdjudicator:", address(adj));
        console.log("Writer agent               :", agent);

        vm.writeFile(
            "./deployments/PredictionMarketAdjudicator.txt",
            vm.toString(address(adj))
        );
    }
}
