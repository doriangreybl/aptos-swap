

export const MAX_TRANSACTIONS_PER_WALLET = 25; // transactions per wallet

export const MIN_APTOS_BALANCE = 0.005; // 0.0025 APTOS balance ~ 0.02 $

export const MIN_AMOUNTS: Record<string, number> = {
  'AptosCoin': MIN_APTOS_BALANCE,
  'USDT': 0.5,
  'USDC': 0.5,
  'WETH': 0.0005,
};

export const MIN_WAIT_TIME = 1; // MINUTES

export const MAX_WAIT_TIME = 2; // MINUTES

export const MIN_SWAP_PERCENT = 20; // %

export const MAX_SWAP_PERCENT = 90; // %

export let TG_CHAT_ID = 0; // Telegram chat id

export let TG_TOKEN = ''; // Telegram bot token
