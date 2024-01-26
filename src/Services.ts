import { AptosAccount, AptosClient } from "aptos";
import { APTOS_RPC_PROVIDER, COINS, DECIMALS } from "./AptosConstants";
import { retry } from "./Helpers";
import { LEND_AMOUNTS, MAX_SWAP_PERCENT, MIN_SWAP_PERCENT } from "../DEPENDENCIES";


const client = new AptosClient(APTOS_RPC_PROVIDER);

export async function thalaMintMod(
  pk: string,
): Promise<{
  result: boolean;
  name?: string;
  txHash?: string;
  totalPrice?: number;
  totalVolume?: number;
  aptosAddress?: string;
}> {
  let privateKey = pk;
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  const aptosPrivateKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const signer = new AptosAccount(aptosPrivateKey);

  const maxAmount = LEND_AMOUNTS['USDC'];

  const randPercent = Math.floor(Math.random() * (MAX_SWAP_PERCENT - MIN_SWAP_PERCENT + 1) + MIN_SWAP_PERCENT);

  const amountInWei = Math.floor(maxAmount * 10 ** DECIMALS['USDC'] / 100 * randPercent);

  const payload = {
    "function": "0x6f986d146e4a90b828d8c12c14b6f4e003fdff11a8eecceceb63744363eaac01::psm_scripts::mint",
    "type_arguments": [
      COINS['USDC']
    ],
    "arguments": [
      amountInWei
    ],
    "type": "entry_function_payload"
  };
  
  const nonce = (await retry(() => client.getAccount(signer.address()))).sequence_number;
  const gasPrice = await retry(() => client.estimateGasPrice());

  const tx = await retry(() => client.generateTransaction(
    signer.address(),
    payload,
    {
      gas_unit_price: gasPrice.prioritized_gas_estimate!.toString(),
      max_gas_amount: '1000',
      sequence_number: nonce.toString(),
    }
  ));

  const signedTx = await retry(() => client.signTransaction(signer, tx));
  const sendTx = await retry(() => client.submitTransaction(signedTx));
  await retry(() => client.waitForTransaction(sendTx.hash));

  return {
    result: true,
    name: `Minted MOD using USDC on Thala`,
    txHash: sendTx.hash,
    aptosAddress: signer.address().toString(),
    totalVolume: 0,
  }
}

export async function abelLendAsset(
  pk: string,
  tokenFromName: string,
): Promise<{
  result: boolean;
  name?: string;
  txHash?: string;
  totalPrice?: number;
  totalVolume?: number;
  aptosAddress?: string;
}> {
  let privateKey = pk;
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  const aptosPrivateKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const signer = new AptosAccount(aptosPrivateKey);

  const maxAmount = LEND_AMOUNTS[tokenFromName];

  const randPercent = Math.floor(Math.random() * (MAX_SWAP_PERCENT - MIN_SWAP_PERCENT + 1) + MIN_SWAP_PERCENT);

  const amountInWei = Math.floor(maxAmount * 10 ** DECIMALS[tokenFromName] / 100 * randPercent);

  const payload = {
    "function": "0xc0188ad3f42e66b5bd3596e642b8f72749b67d84e6349ce325b27117a9406bdf::acoin_lend::mint_entry",
    "type_arguments": [
      COINS[tokenFromName]
    ],
    "arguments": [
      amountInWei
    ],
    "type": "entry_function_payload"
  };
  
  const nonce = (await retry(() => client.getAccount(signer.address()))).sequence_number;
  const gasPrice = await retry(() => client.estimateGasPrice());

  const tx = await retry(() => client.generateTransaction(
    signer.address(),
    payload,
    {
      gas_unit_price: gasPrice.prioritized_gas_estimate!.toString(),
      max_gas_amount: '5000',
      sequence_number: nonce.toString(),
    }
  ));

  const signedTx = await retry(() => client.signTransaction(signer, tx));
  const sendTx = await retry(() => client.submitTransaction(signedTx));
  await retry(() => client.waitForTransaction(sendTx.hash));

  return {
    result: true,
    name: `Lend ${tokenFromName} on Abel`,
    txHash: sendTx.hash,
    aptosAddress: signer.address().toString(),
    totalVolume: 0,
  }
}
