#!/usr/bin/env bash
# One-shot demo setup. Runs from a clean state to a configured Aave V3
# deployment with the price oracle agent registered and producing prices.
#
# Prerequisites:
#   - theseus-cli + theseus-node installed (https://github.com/Theseuschain)
#   - foundry (forge/cast/anvil)
#   - rust toolchain for the CLI

set -euo pipefail

cd "$(dirname "$0")/.."

REPO_ROOT="$(pwd)"
DEPLOYMENTS="$REPO_ROOT/contracts/deployments"
mkdir -p "$DEPLOYMENTS"

LOG() { printf "\033[1;34m[setup]\033[0m %s\n" "$*"; }

# ---------------------------------------------------------------------------
# 1. Vendor Aave V3 (no-op if already vendored).
# ---------------------------------------------------------------------------
LOG "Vendoring Aave V3..."
"$REPO_ROOT/scripts/vendor_aave.sh"

# ---------------------------------------------------------------------------
# 2. Start a local Theseus node if one isn't already running.
# ---------------------------------------------------------------------------
if ! curl -sf "http://127.0.0.1:9933" -X POST \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; then
    LOG "Starting local Theseus node..."
    theseus-node --dev --tmp \
        --rpc-cors=all --rpc-port=9944 --rpc-external \
        --evm-rpc-port=9933 \
        > "$REPO_ROOT/.node.log" 2>&1 &
    echo $! > "$REPO_ROOT/.node.pid"

    # Wait for both endpoints to come up.
    until curl -sf "http://127.0.0.1:9933" -X POST \
          -H 'Content-Type: application/json' \
          -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; do
        sleep 1
    done
    LOG "Theseus node ready."
else
    LOG "Reusing running Theseus node."
fi

# ---------------------------------------------------------------------------
# 3. Register the price oracle SHIP agent. theseus-cli prints the agent's
#    substrate AccountId and EVM-mapped address on success.
# ---------------------------------------------------------------------------
LOG "Deploying price_oracle.ship..."
DEPLOY_OUTPUT=$(theseus-cli deploy-agent agents/price_oracle.ship --json)
AGENT_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.agent_id')
AGENT_EVM=$(echo "$DEPLOY_OUTPUT" | jq -r '.agent_evm_address')
echo "$AGENT_ID" > "$DEPLOYMENTS/AgentId.txt"
LOG "Agent ID:    $AGENT_ID"
LOG "Agent EVM:   $AGENT_EVM"

# ---------------------------------------------------------------------------
# 4. Deploy mock WETH / USDC / USDC fixed-$1 feed (local demo only).
# ---------------------------------------------------------------------------
LOG "Deploying mocks..."
forge script contracts/script/DeployMocks.s.sol \
    --rpc-url "$THESEUS_EVM_RPC" \
    --private-key "$DEPLOYER_KEY" \
    --broadcast > "$REPO_ROOT/.deploy-mocks.log" 2>&1
WETH=$(cat "$DEPLOYMENTS/WETH.txt")
USDC=$(cat "$DEPLOYMENTS/USDC.txt")
USDC_FEED=$(cat "$DEPLOYMENTS/USDC_FEED.txt")
LOG "WETH:        $WETH"
LOG "USDC:        $USDC"
LOG "USDC feed:   $USDC_FEED"

# ---------------------------------------------------------------------------
# 5. Deploy AgentPriceFeed (writer = registered agent's EVM address).
# ---------------------------------------------------------------------------
LOG "Deploying AgentPriceFeed..."
AGENT_EVM_ADDRESS="$AGENT_EVM" \
    forge script contracts/script/DeployFeed.s.sol \
    --rpc-url "$THESEUS_EVM_RPC" \
    --private-key "$DEPLOYER_KEY" \
    --broadcast > "$REPO_ROOT/.deploy-feed.log" 2>&1
AGENT_FEED=$(cat "$DEPLOYMENTS/AgentPriceFeed.txt")
LOG "AgentPriceFeed: $AGENT_FEED"

# ---------------------------------------------------------------------------
# 6. Deploy Aave V3.
# ---------------------------------------------------------------------------
LOG "Deploying Aave V3..."
forge script contracts/script/DeployAave.s.sol \
    --rpc-url "$THESEUS_EVM_RPC" \
    --private-key "$DEPLOYER_KEY" \
    --broadcast > "$REPO_ROOT/.deploy-aave.log" 2>&1
LOG "Aave addresses: see $DEPLOYMENTS/"

# ---------------------------------------------------------------------------
# 7. Configure WETH/USDC reserves; point Aave's oracle at AgentPriceFeed.
# ---------------------------------------------------------------------------
LOG "Configuring reserves..."
POOL_ADDRESSES_PROVIDER=$(cat "$DEPLOYMENTS/PoolAddressesProvider.txt") \
    AAVE_ORACLE=$(cat "$DEPLOYMENTS/AaveOracle.txt") \
    ATOKEN_IMPL=$(cat "$DEPLOYMENTS/ATokenImpl.txt") \
    VARIABLE_DEBT_IMPL=$(cat "$DEPLOYMENTS/VariableDebtImpl.txt") \
    STABLE_DEBT_IMPL=$(cat "$DEPLOYMENTS/StableDebtImpl.txt") \
    AGENT_PRICE_FEED="$AGENT_FEED" \
    WETH="$WETH" \
    USDC="$USDC" \
    USDC_FEED="$USDC_FEED" \
    forge script contracts/script/ConfigureMarket.s.sol \
    --rpc-url "$THESEUS_EVM_RPC" \
    --private-key "$DEPLOYER_KEY" \
    --broadcast > "$REPO_ROOT/.configure.log" 2>&1
LOG "Reserves configured."

# ---------------------------------------------------------------------------
# 8. Wait for the agent's first scheduled run so the feed has a price.
# ---------------------------------------------------------------------------
LOG "Waiting for first agent run (~60s)..."
sleep 65
op status

LOG "Setup complete. Try: ./scripts/demo.sh"
