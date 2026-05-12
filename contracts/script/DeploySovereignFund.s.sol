// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";
import "../src/SovereignFund.sol";

/// @notice Deploys the SovereignFund wired to a Uniswap V3 SwapRouter.
///
/// @dev Reads from env:
///        AGENT_EVM_ADDRESS      - the agent's EOA (centralized agent for now)
///        USDC_ADDRESS           - the USDC ERC20 on the target chain
///        WETH_ADDRESS           - the WETH ERC20 on the target chain
///        SWAP_ROUTER_ADDRESS    - Uniswap V3 SwapRouter (or SwapRouter02)
///        POOL_FEE               - pool fee tier in hundredths of a bip
///                                 (500 = 0.05%, 3000 = 0.3%, 10000 = 1%)
///
/// @dev Reference addresses on common testnets (verify before using):
///
///   Sepolia
///     USDC          0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238 (Circle dev)
///     WETH          0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14
///     SwapRouter02  0x3bFA4769FB09eefC5a80d6E87c3B9C650f7Ae48E
///     pool 0.05%    typical USDC/WETH tier
///
///   Base Sepolia
///     USDC          0x036CbD53842c5426634e7929541eC2318f3dCF7e
///     WETH          0x4200000000000000000000000000000000000006
///     SwapRouter02  0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4
///
///   Theseus EVM (when a public testnet is up)
///     USDC          NEXT_PUBLIC_USDC from setup_demo.sh
///     WETH          NEXT_PUBLIC_WETH from setup_demo.sh
///     SwapRouter    deployed by the theseus-layerzero-evm package
contract DeploySovereignFund is Script {
    function run() external {
        address agent = vm.envAddress("AGENT_EVM_ADDRESS");
        address usdcAddr = vm.envAddress("USDC_ADDRESS");
        address wethAddr = vm.envAddress("WETH_ADDRESS");
        address routerAddr = vm.envAddress("SWAP_ROUTER_ADDRESS");
        uint24 poolFee = uint24(vm.envUint("POOL_FEE"));

        vm.startBroadcast();
        SovereignFund fund = new SovereignFund(
            agent,
            IERC20(usdcAddr),
            IERC20(wethAddr),
            ISwapRouter(routerAddr),
            poolFee,
            "Sovereign fund (Theseus Agent)"
        );
        vm.stopBroadcast();

        console.log("SovereignFund:", address(fund));
        console.log("Writer agent :", agent);
        console.log("USDC         :", usdcAddr);
        console.log("WETH         :", wethAddr);
        console.log("SwapRouter   :", routerAddr);
        console.log("Pool fee     :", poolFee);

        vm.writeFile(
            "./deployments/SovereignFund.txt",
            vm.toString(address(fund))
        );
    }
}
