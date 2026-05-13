# Base Sepolia deployments

Chain id `84532`. Agent EOA (sole writer for every contract):
`0xF40294f810DD786E705f20D67075DDa9a7f87F8f`

All contracts compile with solc `0.8.22` from `foundry.toml`'s default
profile and are deployed from `contracts/script/Deploy*.s.sol`.

## Live contracts

| Contract | Address | Tier |
|---|---|---|
| SovereignFund | [`0x3e1cEd606571A35c43DA11a3b21C051690Bd926a`](https://sepolia.basescan.org/address/0x3e1cEd606571A35c43DA11a3b21C051690Bd926a) | Sovereign (holds funds) |
| LaunchSniperFund | [`0xa6FbaadeA4e7f58D812D989737D708B279E8bd21`](https://sepolia.basescan.org/address/0xa6FbaadeA4e7f58D812D989737D708B279E8bd21) | Sovereign (paper) |
| TerraFailsafe | [`0x0B59da3768CB0F1725A1C2183dD1Ad93058394d2`](https://sepolia.basescan.org/address/0x0B59da3768CB0F1725A1C2183dD1Ad93058394d2) | Civic gate |
| BridgeGuardian | [`0xe442277ba5ce3f5aF5eDAE26206976ADC964C26C`](https://sepolia.basescan.org/address/0xe442277ba5ce3f5aF5eDAE26206976ADC964C26C) | Civic gate |
| GovernanceReviewer | [`0xc9CCF578093603e419997358fa9646Bd891B018a`](https://sepolia.basescan.org/address/0xc9CCF578093603e419997358fa9646Bd891B018a) | Civic advisory |
| AviationSafetyReviewer | [`0x453cE65E5D6eBc6C71f3e420e720d2C2E1D03bce`](https://sepolia.basescan.org/address/0x453cE65E5D6eBc6C71f3e420e720d2C2E1D03bce) | Civic advisory |
| PredictionMarketAdjudicator | [`0xd14A0963D48B944463F3fE6e776C11e09101bE40`](https://sepolia.basescan.org/address/0xd14A0963D48B944463F3fE6e776C11e09101bE40) | Civic gate |

Not deployed:
- `AgentPriceFeed.sol` — inherits from `aave-v3-core`, which isn't
  installed in this workspace. The Aave Oracle UI demo runs against
  mocked state and doesn't need an on-chain feed.
