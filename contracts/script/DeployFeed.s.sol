// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/AgentPriceFeed.sol";

/// @notice Deploys the AgentPriceFeed for ETH/USD.
/// @dev    The agent's EVM-mapped address is read from $AGENT_EVM_ADDRESS.
///         scripts/setup_demo.sh resolves this from the registered SHIP agent.
contract DeployFeed is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");

        vm.startBroadcast();
        AgentPriceFeed feed = new AgentPriceFeed(
            agent,
            8,                  // Chainlink convention for USD pairs
            "ETH/USD (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("AgentPriceFeed:", address(feed));
        console.log("Writer agent  :", agent);

        vm.writeFile("./deployments/AgentPriceFeed.txt", vm.toString(address(feed)));
    }
}
