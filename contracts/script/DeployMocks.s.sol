// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import {MockWETH9} from "../src/mocks/MockWETH9.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {FixedPriceFeed} from "../src/mocks/FixedPriceFeed.sol";

/// @notice Deploys the demo's local-only assets: WETH9, mock USDC, and a
///         fixed-$1 USDC price feed. These addresses get persisted into
///         contracts/deployments/ for the rest of the deploy chain.
contract DeployMocks is Script {
    function run() external {
        vm.startBroadcast();

        MockWETH9 weth = new MockWETH9();
        MockERC20 usdc = new MockERC20("USD Coin (mock)", "USDC", 6);
        FixedPriceFeed usdcFeed = new FixedPriceFeed(1e8, 8, "USDC/USD (fixed)");

        // Mint some USDC liquidity to the deployer so they can act as a
        // borrower-counterparty / liquidator in the demo.
        usdc.mint(msg.sender, 1_000_000e6);

        vm.stopBroadcast();

        vm.writeFile("./deployments/WETH.txt", vm.toString(address(weth)));
        vm.writeFile("./deployments/USDC.txt", vm.toString(address(usdc)));
        vm.writeFile("./deployments/USDC_FEED.txt", vm.toString(address(usdcFeed)));

        console.log("WETH      :", address(weth));
        console.log("USDC      :", address(usdc));
        console.log("USDC feed :", address(usdcFeed));
    }
}
