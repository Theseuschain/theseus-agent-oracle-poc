import { createPublicClient, defineChain, http, parseAbi } from "viem";
import { getBrowserConfig } from "./deployment";

const cfg = getBrowserConfig();

export const theseus = defineChain({
  id: cfg.chainId,
  name: "Theseus EVM",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [cfg.evmRpc] } },
});

export const publicClient = createPublicClient({
  chain: theseus,
  transport: http(cfg.evmRpc),
});

export const FEED_ABI = parseAbi([
  "function latestAnswer() view returns (int256)",
  "function latestTimestamp() view returns (uint256)",
  "function latestRoundId() view returns (uint80)",
  "function latestDecision() view returns (uint8)",
  "function rounds(uint80) view returns (int256 answer, uint256 startedAt, uint256 updatedAt, uint8 decision, bytes32 reasonHash)",
  "event PriceUpdated(uint80 indexed roundId, int256 answer, uint256 updatedAt)",
  "event Refused(uint80 indexed roundId, uint256 updatedAt, bytes32 reasonHash)",
]);

export const POOL_ABI = parseAbi([
  "function supply(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 interestRateMode, address onBehalfOf) returns (uint256)",
  "function getUserAccountData(address user) view returns (uint256 totalCollateralBase, uint256 totalDebtBase, uint256 availableBorrowsBase, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);

export const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
]);

export const ADDRESSES = {
  feed: cfg.agentPriceFeed,
  pool: cfg.pool,
  weth: cfg.weth,
  usdc: cfg.usdc,
};
