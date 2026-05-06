#!/usr/bin/env bash
# One-shot demo setup. Runs from a clean state to a configured Aave V3
# deployment with the price oracle agent registered and producing prices.

set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
DEPLOYMENTS="$REPO_ROOT/contracts/deployments"
mkdir -p "$DEPLOYMENTS"

LOG()  { printf "\033[1;34m[setup]\033[0m %s\n" "$*"; }
DIE()  { printf "\033[1;31m[setup]\033[0m %s\n" "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 0. Prerequisites + env
# ---------------------------------------------------------------------------
for cmd in theseus-cli theseus-node forge cast jq curl; do
    command -v "$cmd" >/dev/null 2>&1 || DIE "missing required command: $cmd"
done

# Source local env if present.
if [ -f "$REPO_ROOT/.env.local" ]; then
    # shellcheck disable=SC1091
    set -a
    . "$REPO_ROOT/.env.local"
    set +a
fi

THESEUS_EVM_RPC="${THESEUS_EVM_RPC:-http://127.0.0.1:9933}"
THESEUS_WS="${THESEUS_WS:-ws://127.0.0.1:9944}"
DEPLOYER_KEY="${DEPLOYER_KEY:-}"
[ -n "$DEPLOYER_KEY" ] || DIE "DEPLOYER_KEY not set (export or place in .env.local)"

# ---------------------------------------------------------------------------
# 1. Vendor Aave V3 (no-op if already vendored).
# ---------------------------------------------------------------------------
LOG "Vendoring Aave V3..."
"$REPO_ROOT/scripts/vendor_aave.sh"

# ---------------------------------------------------------------------------
# 2. Start a local Theseus node if one isn't already running.
# ---------------------------------------------------------------------------
if ! curl -sf "$THESEUS_EVM_RPC" -X POST \
     -H 'Content-Type: application/json' \
     -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; then
    LOG "Starting local Theseus node..."
    theseus-node --dev --tmp \
        --rpc-cors=all --rpc-port=9944 --rpc-external \
        --evm-rpc-port=9933 \
        > "$REPO_ROOT/.node.log" 2>&1 &
    echo $! > "$REPO_ROOT/.node.pid"

    # Wait for both endpoints to come up. Cap at 60s.
    timeout=60
    until curl -sf "$THESEUS_EVM_RPC" -X POST \
          -H 'Content-Type: application/json' \
          -d '{"jsonrpc":"2.0","method":"eth_chainId","params":[],"id":1}' >/dev/null 2>&1; do
        sleep 1
        timeout=$((timeout - 1))
        [ $timeout -gt 0 ] || DIE "node did not become ready within 60s; see .node.log"
    done
    LOG "Theseus node ready."
else
    LOG "Reusing running Theseus node."
fi

# ---------------------------------------------------------------------------
# 3. Register the price oracle SHIP agent. Returns the substrate AccountId
#    and the EVM-mapped address.
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
# 4. Forge scripts. Run from contracts/ so vm.writeFile("./deployments/...")
#    writes to contracts/deployments/ — the directory the rest of the CLI/UI
#    reads from.
# ---------------------------------------------------------------------------
forge_run() {
    local label="$1"; shift
    LOG "$label..."
    (
        cd "$REPO_ROOT/contracts"
        forge script "$@" \
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
STABLE_DEBT_IMPL="$(cat "$DEPLOYMENTS/StableDebtImpl.txt")" \
AGENT_PRICE_FEED="$AGENT_FEED" \
WETH="$WETH" \
USDC="$USDC" \
USDC_FEED="$USDC_FEED" \
forge_run "Configuring Aave reserves" \
    script/ConfigureMarket.s.sol

# ---------------------------------------------------------------------------
# 6. Patch the SHIP agent with the deployed feed address. The agent was
#    deployed in step 3 with a placeholder; the runtime supports re-deploying
#    or updating the const via `theseus-cli set-agent-const`.
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
