#!/usr/bin/env bash
# End-to-end demo: happy path → tampered venue → agent refusal → halted Aave.
#
# Run after scripts/setup_demo.sh.

set -euo pipefail

cd "$(dirname "$0")/.."

LOG()  { printf "\n\033[1;34m[demo]\033[0m %s\n" "$*"; }
WAIT() { sleep "${1:-65}"; }

LOG "1. Starting state."
op status

LOG "2. Deposit 1 WETH as collateral."
op deposit 1
op status

LOG "3. Borrow 1500 USDC against the WETH."
op borrow 1500
op status

LOG "4. Tamper: report Uniswap as ETH=\$100,000 for the next agent run."
op tamper uniswap --price 100000 --runs 1

LOG "   Waiting ~60s for the next agent cycle..."
WAIT 65

LOG "5. The agent should have refused. Check feed state."
op status

LOG "6. Borrowing more should now revert (PriceRefused)."
if op borrow 100; then
    echo "   UNEXPECTED: borrow succeeded with refused feed."
    exit 1
else
    echo "   ✓ borrow reverted as expected."
fi

LOG "7. Liquidations should also revert."
if op liquidate 0x0000000000000000000000000000000000000001 USDC 1; then
    echo "   UNEXPECTED: liquidationCall succeeded with refused feed."
    exit 1
else
    echo "   ✓ liquidationCall reverted as expected."
fi

LOG "8. Reset tamper. Next agent run should re-price."
op reset
WAIT 65

LOG "9. Final state."
op status

LOG "Demo complete."
