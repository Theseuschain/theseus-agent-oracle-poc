// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

import "forge-std/Script.sol";

import {PoolAddressesProvider} from "aave-v3-core/protocol/configuration/PoolAddressesProvider.sol";
import {PoolAddressesProviderRegistry} from "aave-v3-core/protocol/configuration/PoolAddressesProviderRegistry.sol";
import {ACLManager} from "aave-v3-core/protocol/configuration/ACLManager.sol";
import {Pool} from "aave-v3-core/protocol/pool/Pool.sol";
import {PoolConfigurator} from "aave-v3-core/protocol/pool/PoolConfigurator.sol";
import {AaveOracle} from "aave-v3-core/misc/AaveOracle.sol";
import {AToken} from "aave-v3-core/protocol/tokenization/AToken.sol";
import {VariableDebtToken} from "aave-v3-core/protocol/tokenization/VariableDebtToken.sol";
import {StableDebtToken} from "aave-v3-core/protocol/tokenization/StableDebtToken.sol";
import {DefaultReserveInterestRateStrategy} from
    "aave-v3-core/protocol/pool/DefaultReserveInterestRateStrategy.sol";

import {IPoolAddressesProvider} from "aave-v3-core/interfaces/IPoolAddressesProvider.sol";

/// @notice Deploys a minimal Aave V3 stack on Theseus EVM.
/// @dev    Aave V3 contracts are vendored unmodified at contracts/lib/aave-v3-core.
///         This script deploys: registry, addresses provider, ACL manager, pool impl,
///         configurator impl, oracle, and the aToken/debtToken implementations.
///
///         Reserve configuration (registering WETH/USDC, pointing the oracle at our feed)
///         happens in ConfigureMarket.s.sol after this runs.
contract DeployAave is Script {
    uint256 constant MARKET_ID = 1;

    function run() external {
        address admin = msg.sender;

        vm.startBroadcast();

        // 1. Registry
        PoolAddressesProviderRegistry registry = new PoolAddressesProviderRegistry(admin);

        // 2. Addresses provider for this market
        PoolAddressesProvider addressesProvider = new PoolAddressesProvider("Theseus-Agent-Oracle", admin);
        addressesProvider.setMarketId("Theseus-Agent-Oracle");
        registry.registerAddressesProvider(address(addressesProvider), MARKET_ID);

        // 3. ACL
        addressesProvider.setACLAdmin(admin);
        ACLManager aclManager = new ACLManager(IPoolAddressesProvider(address(addressesProvider)));
        addressesProvider.setACLManager(address(aclManager));
        aclManager.addPoolAdmin(admin);
        aclManager.addAssetListingAdmin(admin);
        aclManager.addRiskAdmin(admin);

        // 4. Pool impl + configurator impl (proxies are set up by addressesProvider)
        Pool poolImpl = new Pool(IPoolAddressesProvider(address(addressesProvider)));
        addressesProvider.setPoolImpl(address(poolImpl));

        PoolConfigurator configuratorImpl = new PoolConfigurator();
        addressesProvider.setPoolConfiguratorImpl(address(configuratorImpl));

        // 5. Oracle. Initially with empty asset sources — ConfigureMarket sets WETH source
        //    to the AgentPriceFeed.
        address[] memory assets = new address[](0);
        address[] memory sources = new address[](0);
        AaveOracle oracle = new AaveOracle(
            IPoolAddressesProvider(address(addressesProvider)),
            assets,
            sources,
            address(0),     // fallback oracle (none)
            address(0),     // base currency (USD = address(0) by Aave V3 convention)
            1e8             // base currency unit (1 USD with 8 decimals)
        );
        addressesProvider.setPriceOracle(address(oracle));

        // 6. Token implementations (used as templates by PoolConfigurator.initReserves)
        AToken aTokenImpl = new AToken(Pool(addressesProvider.getPool()));
        VariableDebtToken variableDebtImpl = new VariableDebtToken(Pool(addressesProvider.getPool()));
        StableDebtToken stableDebtImpl = new StableDebtToken(Pool(addressesProvider.getPool()));

        vm.stopBroadcast();

        // Persist for the next script
        vm.writeFile("./deployments/PoolAddressesProvider.txt", vm.toString(address(addressesProvider)));
        vm.writeFile("./deployments/Pool.txt", vm.toString(addressesProvider.getPool()));
        vm.writeFile("./deployments/AaveOracle.txt", vm.toString(address(oracle)));
        vm.writeFile("./deployments/ATokenImpl.txt", vm.toString(address(aTokenImpl)));
        vm.writeFile("./deployments/VariableDebtImpl.txt", vm.toString(address(variableDebtImpl)));
        vm.writeFile("./deployments/StableDebtImpl.txt", vm.toString(address(stableDebtImpl)));

        console.log("PoolAddressesProvider:", address(addressesProvider));
        console.log("Pool                 :", addressesProvider.getPool());
        console.log("AaveOracle           :", address(oracle));
    }
}
