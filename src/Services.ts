import { AptosAccount, AptosClient } from "aptos";
import { APTOS_RPC_PROVIDER, COINS, DECIMALS, USELESS_TOKENS } from "./AptosConstants";
import { retry, getRate, shuffleArray } from "./Helpers";
import { LEND_AMOUNTS, MAX_SWAP_PERCENT, MIN_SWAP_PERCENT } from "../DEPENDENCIES";
import { ethers } from "ethers";


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

export async function liquidSwapAptos(
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

  const amountInUsd = +(amountInWei *  Number(rateTokenFrom)).toFixed(6) / 10 ** DECIMALS[tokenFromName];
  totalVolume += amountInUsd;
  const amountOut = ethers.utils.parseUnits((amountInUsd / Number(rateTokenTo)).toFixed(6), DECIMALS[tokenToName]);

  if (amountInWei > (aptBalance.data as any).coin.value) {
    return {
      result: false,
    }
  }

  const payload = {
    "function": "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::scripts_v2::swap",
    "type_arguments": [
      COINS[tokenFromName],
      COINS[tokenToName],
      "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::curves::Uncorrelated"
    ],
    "arguments": [
      amountInWei,
      amountOut.mul(92).div(100).toString(),
    ],
    "type": "entry_function_payload"
  }

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
    name: `Swap ${tokenFromName} to ${tokenToName} on Aptos Liquidswap`,
    txHash: sendTx.hash,
    totalVolume,
    aptosAddress: signer.address().toString(),
  }
}

export async function liquidswapAddLiquidity(
  pk: string,
  tokenA: string,
  tokenB: string,
): Promise<{
  result: boolean;
  name?: string;
  txHash?: string;
  aptosAddress?: string;
}> {

  let privateKey = pk;
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  const aptosPrivateKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const signer = new AptosAccount(aptosPrivateKey);

  const tokenBalanceA = await retry(() => client.getAccountResource(signer.address(), `0x1::coin::CoinStore<${COINS[tokenA]}>`));
  const tokenBalanceB = await retry(() => client.getAccountResource(signer.address(), `0x1::coin::CoinStore<${COINS[tokenB]}>`));

  if ((tokenBalanceA.data as any).coin.value < LEND_AMOUNTS[tokenA] || (tokenBalanceB.data as any).coin.value < LEND_AMOUNTS[tokenB]) {
    return {
      result: false,
    }
  }

  const rateTokenA = await getRate(tokenA);
  const rateTokenB = await getRate(tokenB);

  //const percent = Math.floor(Math.random() * (MAX_SWAP_PERCENT - MIN_SWAP_PERCENT + 1) + MIN_SWAP_PERCENT);
  const amountA = Math.floor(LEND_AMOUNTS[tokenA] * 10 ** DECIMALS[tokenA]);
  const amountInUsdA = +(amountA / 10 ** DECIMALS[tokenA] * Number(rateTokenA)).toFixed(6);
  const amountB = Math.floor(amountInUsdA / Number(rateTokenB) * 10 ** DECIMALS[tokenB]);

  console.log('Amount A: ' + amountA);
  console.log('Amount B: ' + amountB);
  console.log('Amount in USD: ' + amountInUsdA);


  const payload = {
    "function": "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::scripts_v2::add_liquidity",
    "type_arguments": [
      COINS[tokenA],
      COINS[tokenB],
      "0x190d44266241744264b964a37b8f09863167a12d3e70cda39376cfb4e3561e12::curves::Stable"
    ],
    "arguments": [
      amountA,
      Math.floor(amountA * 0.80),
      amountB,
      Math.floor(amountB * 0.80),
    ],
    "type": "entry_function_payload"
  }

  const nonce = (await retry(() => client.getAccount(signer.address()))).sequence_number;
  const gasPrice = await retry(() => client.estimateGasPrice());

  const tx = await retry(() => client.generateTransaction(
    signer.address(),
    payload,
    {
      gas_unit_price: gasPrice.prioritized_gas_estimate!.toString(),
      max_gas_amount: '4000',
      sequence_number: nonce.toString(),
    }
  ));

  const signedTx = await retry(() => client.signTransaction(signer, tx));
  const sendTx = await retry(() => client.submitTransaction(signedTx));
  await retry(() => client.waitForTransaction(sendTx.hash));

  return {
    result: true,
    name: `Added liquidity ${tokenA} and ${tokenB} on Aptos Liquidswap`,
    txHash: sendTx.hash,
    aptosAddress: signer.address().toString(),
  }
}

export async function addToken(
  pk: string
): Promise<{
  result: boolean;
  name?: string;
  txHash?: string;
  aptosAddress?: string;
  totalVolume?: number;
}> {
  let totalVolume = 0;

  let privateKey = pk;
  if (privateKey.startsWith('0x')) {
    privateKey = privateKey.slice(2);
  }
  const aptosPrivateKey = Uint8Array.from(Buffer.from(privateKey, 'hex'));
  const signer = new AptosAccount(aptosPrivateKey);

  let token = shuffleArray(USELESS_TOKENS)[0];
  console.log('Token: ' + token);

  let counter = 0;
  let balanceCheck;
  while (true) {
    if (counter > 10) {
      return {
        result: false,
      }
    }
    counter++;
    try {
      balanceCheck = await client.getAccountResource(signer.address(), `0x1::coin::CoinStore<${token}>`);
    } catch (e: any) {
      if (e.message.includes('Resource not found by Address')) {
        break;
      }
    }
    token = shuffleArray(USELESS_TOKENS)[0];
    continue;
  }

  const payload = {
    "function": "0x1::managed_coin::register",
    "type_arguments": [
      token,
    ],
    "arguments": [],
    "type": "entry_function_payload"
  }

  const nonce = (await retry(() => client.getAccount(signer.address()))).sequence_number;
  const gasPrice = await retry(() => client.estimateGasPrice());

  const tx = await retry(() => client.generateTransaction(
    signer.address(),
    payload,
    {
      gas_unit_price: gasPrice.prioritized_gas_estimate!.toString(),
      max_gas_amount: '500',
      sequence_number: nonce.toString(),
    }
  ));

  const signedTx = await retry(() => client.signTransaction(signer, tx));
  const sendTx = await retry(() => client.submitTransaction(signedTx));
  await retry(() => client.waitForTransaction(sendTx.hash));

  return {
    result: true,
    name: `Added token ${token.replace(/^\w+::/, '')} to wallet`,
    txHash: sendTx.hash,
    aptosAddress: signer.address().toString(),
    totalVolume,
  }
}
