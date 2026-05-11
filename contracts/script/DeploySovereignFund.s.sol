// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/SovereignFund.sol";

/// @notice Deploys the SovereignFund and seeds it with starting USDC + WETH.
/// @dev    Reads agent address, USDC address, and WETH address from env.
///         Existing token contracts must already be deployed (the poc has
///         MockERC20 + MockWETH9 under contracts/src/mocks/).
contract DeploySovereignFund is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");
        address usdcAddr = vm.envAddress("USDC_ADDRESS");
        address wethAddr = vm.envAddress("WETH_ADDRESS");

        vm.startBroadcast();
        SovereignFund fund = new SovereignFund(
            agent,
            IERC20(usdcAddr),
            IERC20(wethAddr),
            "Sovereign fund (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("SovereignFund:", address(fund));
        console.log("Writer agent :", agent);
        console.log("USDC         :", usdcAddr);
        console.log("WETH         :", wethAddr);

        vm.writeFile(
            "./deployments/SovereignFund.txt",
            vm.toString(address(fund))
        );
    }
}
