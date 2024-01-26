

export const APTOS_RPC_PROVIDER = 'https://fullnode.mainnet.aptoslabs.com/v1';

export const COINS: Record<string, string> = {
  AptosCoin: '0x1::aptos_coin::AptosCoin',
  USDT: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDT',
  USDC: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::USDC',
  WETH: '0xf22bede237a07e121b56d91a491eb7bcdfd1f5907926a9e58338f964a01b17fa::asset::WETH',
};

export const DECIMALS: Record<string, number> = {
  USDT: 6,
  USDC: 6,
  WETH: 6,
  AptosCoin: 8,
};

export type Data = {
  address?: string;
  transactions?: number;
  swap?: number;
  lend?: number;
  stableMint?: number;
  totalVolume?: number;
  balances?: Record<string, number>;
}
