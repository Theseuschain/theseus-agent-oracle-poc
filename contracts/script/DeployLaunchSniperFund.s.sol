// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/LaunchSniperFund.sol";

/// @notice Deploys the paper-mode LaunchSniperFund.
///
/// @dev Reads from env:
///        AGENT_EVM_ADDRESS  - the agent's EOA (sole writer)
///        STARTING_USDC      - virtual USDC the fund starts with, in
///                             USDC's 6-decimal units (e.g. 10000000000
///                             for 10,000 USDC)
contract DeployLaunchSniperFund is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");
        uint256 startingUsdc = vm.envUint("STARTING_USDC");

        vm.startBroadcast();
        LaunchSniperFund fund = new LaunchSniperFund(
            agent,
            startingUsdc,
            "Launch sniper (Theseus Agent, paper)"
        );
        vm.stopBroadcast();

        console.log("LaunchSniperFund:", address(fund));
        console.log("Writer agent    :", agent);
        console.log("Starting USDC   :", startingUsdc);

        vm.writeFile(
            "./deployments/LaunchSniperFund.txt",
            vm.toString(address(fund))
        );
    }
}
