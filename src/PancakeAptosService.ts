import { AptosAccount, AptosClient } from "aptos";
import { APTOS_RPC_PROVIDER, COINS, DECIMALS } from "./AptosConstants";
import { retry, getRate } from "./Helpers";
import { ethers } from "ethers";


const client = new AptosClient(APTOS_RPC_PROVIDER);

/**
 * @param pk private key
 * @param tokenFromName token name to swap from
 * @param tokenToName token name to swap to
 * @param amountInWei amount in wei to swap
 */
export async function pancakeAptosSwapTokens(
  pk: string,
  tokenFromName: string,
  tokenToName: string,
  amountInWei: number,
): Promise<{
  result: boolean;
  name?: string;
  txHash?: string;
  totalPrice?: number;
  totalVolume?: number;
  aptosAddress?: string;
}> {
  let totalVolume = 0;
  const tokenFrom = COINS[tokenFromName];

  let privateKey = pk;
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  const aptosPrivateKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const signer = new AptosAccount(aptosPrivateKey);

  const aptBalance = await retry(() => client.getAccountResource(signer.address(), `0x1::coin::CoinStore<${tokenFrom}>`));

  const rateTokenFrom = await getRate(tokenFromName);
  const rateTokenTo = await getRate(tokenToName);

  const amountInUsd = +ethers.utils.formatUnits(amountInWei, DECIMALS[tokenFromName]) * Number(rateTokenFrom);
  totalVolume += amountInUsd;
  const amountOut = ethers.utils.parseUnits((amountInUsd / Number(rateTokenTo)).toFixed(6), DECIMALS[tokenToName]);

  if (amountInWei > (aptBalance.data as any).coin.value) {
    return {
      result: false,
    }
  }

  const payload = {
    function: '0xc7efb4076dbe143cbcd98cfaaa929ecfc8f299203dfff63b95ccb6bfe19850fa::router::swap_exact_input',
    type_arguments: [
      COINS[tokenFromName],
      COINS[tokenToName],
    ],
    arguments: [
      amountInWei,
      amountOut.mul(99).div(100), // min_amount_out
    ],
    type: 'entry_function_payload',
  };

  const nonce = (await retry(() => client.getAccount(signer.address()))).sequence_number;
  const gasPrice = await retry(() => client.estimateGasPrice());

  const tx = await retry(() => client.generateTransaction(
    signer.address(),
    payload,
    {
      gas_unit_price: gasPrice.prioritized_gas_estimate!.toString(),
      max_gas_amount: '100',
      sequence_number: nonce.toString(),
    }
  ));

  const signedTx = await retry(() => client.signTransaction(signer, tx));
  const sendTx = await retry(() => client.submitTransaction(signedTx));
  await retry(() => client.waitForTransaction(sendTx.hash));

  return {
    result: false,
    name: `Swap ${tokenFromName} to ${tokenToName} on Aptos PancakeSwap`,
    txHash: sendTx.hash,
    totalVolume,
    aptosAddress: signer.address().toString(),
  }
}
