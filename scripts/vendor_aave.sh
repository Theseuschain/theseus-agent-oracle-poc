#!/usr/bin/env bash
# Vendors Aave V3 (and required deps) into contracts/lib/ as git submodules.
# This is the only step where we touch the Aave codebase. After this runs,
# the diff against upstream is empty by construction.

set -euo pipefail

cd "$(dirname "$0")/.."

# Pinned commits. Update with care — re-runs of the demo should be reproducible.
AAVE_V3_CORE_COMMIT="9630ab77a8ec77b39432ce596ca22ce4eaba0c44"   # v1.19.3 release tag
OZ_CONTRACTS_COMMIT="dc44c9f1a4fc4d8e2fc4da72ce91b48caa05f04f"   # v4.5.0 (Aave V3 pin)
FORGE_STD_COMMIT="1.9.4"

if [ ! -d contracts/lib/aave-v3-core ]; then
  git submodule add https://github.com/aave/aave-v3-core contracts/lib/aave-v3-core
fi
git -C contracts/lib/aave-v3-core fetch --depth=1 origin "$AAVE_V3_CORE_COMMIT"
git -C contracts/lib/aave-v3-core checkout "$AAVE_V3_CORE_COMMIT"

if [ ! -d contracts/lib/openzeppelin-contracts ]; then
  git submodule add https://github.com/OpenZeppelin/openzeppelin-contracts contracts/lib/openzeppelin-contracts
fi
git -C contracts/lib/openzeppelin-contracts fetch --depth=1 origin "$OZ_CONTRACTS_COMMIT"
git -C contracts/lib/openzeppelin-contracts checkout "$OZ_CONTRACTS_COMMIT"

if [ ! -d contracts/lib/forge-std ]; then
  git submodule add https://github.com/foundry-rs/forge-std contracts/lib/forge-std
fi
git -C contracts/lib/forge-std checkout "v$FORGE_STD_COMMIT"

echo
echo "Aave V3 vendored. Diff against upstream:"
git -C contracts/lib/aave-v3-core diff --stat HEAD
echo
echo "(an empty diff is the point — Aave is unmodified.)"
