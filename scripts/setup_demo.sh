#!/usr/bin/env bash
# One-shot demo setup. Runs from a clean state to a configured Aave V3
# deployment with the price oracle agent registered and producing prices.
#
# This mirrors the local-dev pattern from
# github.com/Theseuschain/theseus-layerzero-evm/packages/lz-local: a
# theseus-node + the `eth-rpc` proxy together expose a substrate WS
# (9944) and an Ethereum-compatible JSON-RPC (8545). PolkaVM compiles
# happen via foundry-polkadot's resolc.

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
DEPLOYMENTS="$REPO_ROOT/contracts/deployments"
mkdir -p "$DEPLOYMENTS"

LOG()  { printf "\033[1;34m[setup]\033[0m %s\n" "$*"; }
DIE()  { printf "\033[1;31m[setup]\033[0m %s\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. Prerequisites
# ---------------------------------------------------------------------------
# - theseus-node + theseus-cli from github.com/theseus-network/theseus-chain
# - eth-rpc proxy (Substrate's Ethereum JSON-RPC translator)
# - foundry-polkadot's `forge` (with resolc 1.0.0). NOT vanilla foundry —
#   PolkaVM bytecode requires resolc, and Theseus runs pallet-revive,
#   not pallet-evm.
# - jq + curl
for cmd in theseus-cli theseus-node eth-rpc forge cast jq curl; do
    command -v "$cmd" >/dev/null 2>&1 || DIE "missing required command: $cmd"
done

# Confirm forge is the polkadot fork by checking for resolc support.
if ! forge --help 2>&1 | grep -q polkadot; then
    LOG "warning: 'forge' on PATH may be vanilla foundry. PolkaVM compile"
    LOG "         requires foundry-polkadot. See README.md for install."
fi

# Source local env if present.
if [ -f "$REPO_ROOT/.env.local" ]; then
    # shellcheck disable=SC1091
    set -a
    . "$REPO_ROOT/.env.local"
    set +a
fi

THESEUS_EVM_RPC="${THESEUS_EVM_RPC:-http://127.0.0.1:8545}"
THESEUS_WS="${THESEUS_WS:-ws://127.0.0.1:9944}"
DEPLOYER_KEY="${DEPLOYER_KEY:-}"
[ -n "$DEPLOYER_KEY" ] || DIE "DEPLOYER_KEY not set (export or place in .env.local)"

# ---------------------------------------------------------------------------
# 1. Vendor Aave V3.
# ---------------------------------------------------------------------------
LOG "Vendoring Aave V3..."
"$REPO_ROOT/scripts/vendor_aave.sh"

# ---------------------------------------------------------------------------
# 2. Start theseus-node + eth-rpc if not already running.
# ---------------------------------------------------------------------------
if ! curl -sf "$THESEUS_EVM_RPC" -X POST \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; then
    LOG "Starting theseus-node..."
    theseus-node --dev --tmp \
        --rpc-cors=all --rpc-port=9944 --rpc-external \
        > "$REPO_ROOT/.node.log" 2>&1 &
    echo $! > "$REPO_ROOT/.node.pid"

    LOG "Starting eth-rpc proxy..."
    eth-rpc --dev > "$REPO_ROOT/.eth-rpc.log" 2>&1 &
    echo $! > "$REPO_ROOT/.eth-rpc.pid"

    timeout=60
    until curl -sf "$THESEUS_EVM_RPC" -X POST \
          -H 'Content-Type: application/json' \
          -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; do
        sleep 1
        timeout=$((timeout - 1))
        [ $timeout -gt 0 ] || DIE "eth-rpc did not become ready within 60s; see .eth-rpc.log"
    done
    LOG "Theseus node + eth-rpc ready."
else
    LOG "Reusing running Theseus node."
fi

# ---------------------------------------------------------------------------
# 3. Register the price oracle SHIP agent.
# ---------------------------------------------------------------------------
LOG "Deploying price_oracle.ship..."
DEPLOY_OUTPUT=$(theseus-cli deploy-agent agents/price_oracle.ship --json)
AGENT_ID=$(echo "$DEPLOY_OUTPUT" | jq -r '.agent_id')
AGENT_EVM=$(echo "$DEPLOY_OUTPUT" | jq -r '.agent_evm_address')
[ "$AGENT_ID" != "null" ] && [ "$AGENT_EVM" != "null" ] || DIE "agent deploy did not return agent_id + agent_evm_address; output:\n$DEPLOY_OUTPUT"
echo "$AGENT_ID" > "$DEPLOYMENTS/AgentId.txt"
LOG "Agent ID:    $AGENT_ID"
LOG "Agent EVM:   $AGENT_EVM"

# ---------------------------------------------------------------------------
# 4. Forge scripts (pvm profile = PolkaVM compile via resolc).
#    Run from contracts/ so vm.writeFile("./deployments/...") writes to
#    contracts/deployments/.
# ---------------------------------------------------------------------------
forge_run() {
    local label="$1"; shift
    LOG "$label..."
    (
        cd "$REPO_ROOT/contracts"
        forge script "$@" \
            --profile pvm \
            --rpc-url "$THESEUS_EVM_RPC" \
            --private-key "$DEPLOYER_KEY" \
            --broadcast
    )
}

forge_run "Deploying mocks (WETH, USDC, USDC feed)" \
    script/DeployMocks.s.sol

WETH=$(cat "$DEPLOYMENTS/WETH.txt")
USDC=$(cat "$DEPLOYMENTS/USDC.txt")
USDC_FEED=$(cat "$DEPLOYMENTS/USDC_FEED.txt")
LOG "WETH:        $WETH"
LOG "USDC:        $USDC"
LOG "USDC feed:   $USDC_FEED"

AGENT_EVM_ADDRESS="$AGENT_EVM" forge_run \
    "Deploying AgentPriceFeed" \
    script/DeployFeed.s.sol

AGENT_FEED=$(cat "$DEPLOYMENTS/AgentPriceFeed.txt")
LOG "AgentPriceFeed: $AGENT_FEED"

forge_run "Deploying Aave V3 stack" \
    script/DeployAave.s.sol

# ---------------------------------------------------------------------------
# 5. Configure WETH/USDC reserves and point Aave's oracle at AgentPriceFeed.
# ---------------------------------------------------------------------------
POOL_ADDRESSES_PROVIDER="$(cat "$DEPLOYMENTS/PoolAddressesProvider.txt")" \
AAVE_ORACLE="$(cat "$DEPLOYMENTS/AaveOracle.txt")" \
ATOKEN_IMPL="$(cat "$DEPLOYMENTS/ATokenImpl.txt")" \
VARIABLE_DEBT_IMPL="$(cat "$DEPLOYMENTS/VariableDebtImpl.txt")" \
STABLE_DEBT_IMPL="$(cat "$DEPLOYMENTS/STABLE_DEBT_IMPL.txt")" \
AGENT_PRICE_FEED="$AGENT_FEED" \
WETH="$WETH" \
USDC="$USDC" \
USDC_FEED="$USDC_FEED" \
forge_run "Configuring Aave reserves" \
    script/ConfigureMarket.s.sol

# ---------------------------------------------------------------------------
# 6. Patch the SHIP agent with the deployed feed address.
# ---------------------------------------------------------------------------
LOG "Updating agent FEED_ADDRESS to $AGENT_FEED..."
theseus-cli set-agent-const "$AGENT_ID" FEED_ADDRESS "$AGENT_FEED" || \
    LOG "warning: set-agent-const not available; redeploy the agent manually with FEED_ADDRESS = $AGENT_FEED"

# ---------------------------------------------------------------------------
# 7. Wait for the first scheduled run so the feed has a price.
# ---------------------------------------------------------------------------
LOG "Waiting for first agent run (~60s)..."
sleep 65
op status

LOG "Setup complete. Try: ./scripts/demo.sh"
