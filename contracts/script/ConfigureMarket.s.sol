// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";

import {IPoolAddressesProvider} from "aave-v3-core/interfaces/IPoolAddressesProvider.sol";
import {IPoolConfigurator} from "aave-v3-core/interfaces/IPoolConfigurator.sol";
import {IAaveOracle} from "aave-v3-core/interfaces/IAaveOracle.sol";
import {ConfiguratorInputTypes} from "aave-v3-core/protocol/libraries/types/ConfiguratorInputTypes.sol";
import {DefaultReserveInterestRateStrategy} from
    "aave-v3-core/protocol/pool/DefaultReserveInterestRateStrategy.sol";

/// @notice Registers WETH and USDC as reserves and points the oracle at our agent feed.
///
/// Inputs (env):
///   POOL_ADDRESSES_PROVIDER  - from DeployAave deployments/
///   AAVE_ORACLE              - from DeployAave deployments/
///   ATOKEN_IMPL              - from DeployAave deployments/
///   VARIABLE_DEBT_IMPL       - from DeployAave deployments/
///   STABLE_DEBT_IMPL         - from DeployAave deployments/
///   AGENT_PRICE_FEED         - from DeployFeed deployments/
///   WETH                     - WETH address (deployed via MockWETH for local demo)
///   USDC                     - USDC address (mock)
///   USDC_FEED                - fixed $1 feed for USDC (mock)
contract ConfigureMarket is Script {
    function run() external {
        IPoolAddressesProvider provider = IPoolAddressesProvider(vm.envAddress("POOL_ADDRESSES_PROVIDER"));
        IAaveOracle oracle = IAaveOracle(vm.envAddress("AAVE_ORACLE"));

        address weth = vm.envAddress("WETH");
        address usdc = vm.envAddress("USDC");
        address agentFeed = vm.envAddress("AGENT_PRICE_FEED");
        address usdcFeed = vm.envAddress("USDC_FEED");

        IPoolConfigurator configurator = IPoolConfigurator(provider.getPoolConfigurator());

        vm.startBroadcast();

        // 1. Point Aave's oracle at our agent feed for WETH.
        //    USDC gets a fixed-$1 mock feed.
        address[] memory assets = new address[](2);
        address[] memory sources = new address[](2);
        assets[0] = weth; sources[0] = agentFeed;
        assets[1] = usdc; sources[1] = usdcFeed;
        oracle.setAssetSources(assets, sources);

        // 2. Interest rate strategy (one strategy reused for both reserves; values are
        //    placeholders sized for the demo, not production).
        DefaultReserveInterestRateStrategy rateStrategy = new DefaultReserveInterestRateStrategy(
            provider,
            0.45e27,        // optimalUsageRatio
            0,              // baseVariableBorrowRate
            0.07e27,        // variableRateSlope1
            3e27,           // variableRateSlope2
            0,              // stableRateSlope1
            0,              // stableRateSlope2
            0,              // baseStableRateOffset
            0,              // stableRateExcessOffset
            0               // optimalStableToTotalDebtRatio
        );

        // 3. Init both reserves.
        ConfiguratorInputTypes.InitReserveInput[] memory inputs =
            new ConfiguratorInputTypes.InitReserveInput[](2);
        inputs[0] = _reserveInput(weth, "WETH", 18, address(rateStrategy));
        inputs[1] = _reserveInput(usdc, "USDC", 6, address(rateStrategy));
        configurator.initReserves(inputs);

        // 4. Enable WETH as collateral, USDC as borrowable.
        configurator.configureReserveAsCollateral(weth, 8000, 8500, 10500);
        configurator.setReserveBorrowing(usdc, true);

        vm.stopBroadcast();

        console.log("WETH oracle source:", agentFeed);
        console.log("USDC oracle source:", usdcFeed);
    }

    function _reserveInput(
        address asset,
        string memory symbol,
        uint8 decimals,
        address rateStrategy
    ) internal view returns (ConfiguratorInputTypes.InitReserveInput memory) {
        return ConfiguratorInputTypes.InitReserveInput({
            aTokenImpl: vm.envAddress("ATOKEN_IMPL"),
            stableDebtTokenImpl: vm.envAddress("STABLE_DEBT_IMPL"),
            variableDebtTokenImpl: vm.envAddress("VARIABLE_DEBT_IMPL"),
            underlyingAssetDecimals: decimals,
            interestRateStrategyAddress: rateStrategy,
            underlyingAsset: asset,
            treasury: msg.sender,
            incentivesController: address(0),
            aTokenName: string.concat("Theseus Agent ", symbol),
            aTokenSymbol: string.concat("a", symbol),
            variableDebtTokenName: string.concat("Theseus Variable Debt ", symbol),
            variableDebtTokenSymbol: string.concat("v", symbol),
            stableDebtTokenName: string.concat("Theseus Stable Debt ", symbol),
            stableDebtTokenSymbol: string.concat("s", symbol),
            params: bytes(""),
            interestRateData: bytes("")
        });
    }
}
