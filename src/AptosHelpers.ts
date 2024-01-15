import { APTOS_RPC_PROVIDER, COINS, DECIMALS } from "./AptosConstants";
import { AptosAccount, AptosClient } from "aptos";


const client = new AptosClient(APTOS_RPC_PROVIDER);

export async function getAptosBalance(pk: string): Promise<Record<string, number>> {
  let balances: Record<string, number> = {};
  let privateKey = pk;
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  const aptosPrivateKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const signer = new AptosAccount(aptosPrivateKey);

  for (const coin in COINS) {
    try {
      const aptBalance = await client.getAccountResource(signer.address(), `0x1::coin::CoinStore<${COINS[coin]}>`);
      const formatedBalance =  (aptBalance.data as any).coin.value / (10 ** DECIMALS[coin]);
      balances[coin] = formatedBalance;
    } catch (e: any) {
      if (String(e.message).includes('Resource not found')) {
        balances[coin] = 0;
      } else {
        console.log(e);
      }
    }
  }

  return balances;
}

export function getAddress(pk: string): string {
  let privateKey = pk;
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  const aptosPrivateKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const signer = new AptosAccount(aptosPrivateKey);
  return signer.address().toString();
}
