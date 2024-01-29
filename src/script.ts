import { DECIMALS, Data } from "./AptosConstants";
import { shuffleArray, sendTelegramMessage, sleep } from "./Helpers";
import { pancakeAptosSwapTokens, convertTokensToApt } from "./PancakeAptosService";
import { getAptosBalance, getAddress } from "./AptosHelpers";
import { MAX_TRANSACTIONS_PER_WALLET, MIN_APTOS_BALANCE, MIN_WAIT_TIME, MAX_WAIT_TIME, MAX_SWAP_PERCENT, MIN_SWAP_PERCENT, MIN_AMOUNTS, ACTIONS } from "../DEPENDENCIES";
import fs from 'fs';
import { thalaMintMod, abelLendAsset } from "./Services";


let data: Record<string, Data> = {};

async function main() {

  const pkArr = fs.readFileSync('keys.txt').toString().replaceAll('\r', '').split('\n');

  if (fs.existsSync('walletsData.json')) {
    data = JSON.parse(fs.readFileSync('walletsData.json').toString());
  }

  while (true) {

    if (pkArr.length === 0) {
      console.log('No more private keys to use');
      await sendTelegramMessage(`🏁 NO MORE KEYS TO USE LEFT, SCRIPT IS FINISHED`);
      fs.writeFileSync('walletsData.json', JSON.stringify(data, null, 2));
      return;
    }

    const pk = shuffleArray(pkArr)[0];
    const address = getAddress(pk);
    console.log('Using address: ' + address + '\n');
    const balances = await getAptosBalance(pk);

    // check if max transactions reached
    if (data[address] && data[address].transactions && data[address].transactions! >= MAX_TRANSACTIONS_PER_WALLET) {
      console.log('Max transactions reached for address: ' + address);

      const convert = await convertTokensToApt(pk, balances);

      if (!convert.result) {
        console.log('Convert to APT failed for address: ' + address);

        data[address].balances = balances;
      } else {

        await sendTelegramMessage(
          `✅ Successfully converted all tokens to APT for address: ${address}, TXs: ${convert.txHashes!.map(tx => `https://tracemove.io/transaction/${tx}`).join(', ')}, total fee: ${(convert.totalPrice)?.toFixed(2)} $`
        );
        const balances = await getAptosBalance(pk);
        data[address].balances = balances;
        data[address].totalVolume = data[address]?.totalVolume ? data[address].totalVolume! + Number((convert.totalVolume)?.toFixed(2)) : Number((convert.totalVolume)?.toFixed(2));
        data[address].transactions = data[address]?.transactions ? data[address].transactions! + convert.txHashes!.length : convert.txHashes!.length;
      }

      await sendTelegramMessage(`🗑 Max transactions reached for address: ${address}, removing from list`);

      pkArr.splice(pkArr.indexOf(pk), 1);

      continue;
    }

    // check if balance is too low
    if (balances['AptosCoin'] <  MIN_APTOS_BALANCE) {
      console.log('AptosCoin balance is too low for address: ' + address);
      await sendTelegramMessage(`🛑 APT balance is too low for address: ${address}, removing from list, current balance: ${balances['AptosCoin']}`);

      pkArr.splice(pkArr.indexOf(pk), 1);

      data[address].balances = balances;

      continue;
    }

    // random tokenFromName with balance > 0
    const balancesKeys = Object.keys(balances).filter(key => balances[key] !== 0);
    const tokenFromName = shuffleArray(balancesKeys)[0];

    // random tokenToName
    const tokenToName = shuffleArray(Object.keys(balances).filter(key => key !== tokenFromName))[0];

    let amountToSwap: number;
    if (tokenFromName === 'AptosCoin') {
      const maxSwapAmount = balances[tokenFromName] - 0.002;

      if (maxSwapAmount <= 0) {
        console.log('AptosCoin balance is too low for address: ' + address);
        continue;
      }

      const amountInWei = +maxSwapAmount.toFixed(6) * 10 ** DECIMALS[tokenFromName];

      const random = Math.floor(Math.random() * (MAX_SWAP_PERCENT - MIN_SWAP_PERCENT + 1) + MIN_SWAP_PERCENT);

      amountToSwap = Math.floor(amountInWei / 100 * random);
    } else {

      if (balances[tokenFromName] <= MIN_AMOUNTS[tokenFromName]) {
        amountToSwap = +balances[tokenFromName].toFixed(6) * 10 ** DECIMALS[tokenFromName];
      } else {
      const balanceInWei = +balances[tokenFromName].toFixed(6) * 10 ** DECIMALS[tokenFromName];

      const random = Math.floor(Math.random() * (MAX_SWAP_PERCENT - MIN_SWAP_PERCENT + 1) + MIN_SWAP_PERCENT);

      amountToSwap = Math.floor(balanceInWei / 100 * random);
      }
    }

    const possibleActions: string[] = [];

    if (!data[address] || !data[address].swap || data[address].swap! < ACTIONS['swap']) {
      possibleActions.push('swap');
    }

    if (!data[address] || !data[address].lend || data[address].lend! < ACTIONS['lend']) {
      possibleActions.push('lend');
    }

    if ((!data[address] || !data[address].stableMint || data[address].stableMint! < ACTIONS['stableMint']) && balancesKeys.includes('USDC') && balances['USDC'] >= MIN_AMOUNTS['USDC']) {
      possibleActions.push('stableMint');
    }

    console.log('Possible actions: ' + possibleActions.join(', '));
    
    if (possibleActions.length === 0) {
      console.log('No more actions left for address: ' + address);
      await sendTelegramMessage(`🛑 No more actions left for address: ${address}, removing from list`);

      pkArr.splice(pkArr.indexOf(pk), 1);

      data[address].balances = balances;

      continue;
    }

    let swap;
    const randomAction = shuffleArray(possibleActions)[0];
    console.log('Random action: ' + randomAction);

    if (randomAction === 'swap') {

      swap = await pancakeAptosSwapTokens(pk, tokenFromName, tokenToName, amountToSwap);

      console.log(`Successfully swapped ${(swap.totalVolume)?.toFixed(2)} $ ${tokenFromName} to ${tokenToName} for address: ${address}, tx: ${swap.txHash} \n`);

      await sendTelegramMessage(
        `✅ Successfully swapped ${(swap.totalVolume)?.toFixed(2)} $ of ${tokenFromName} to ${tokenToName} for address: ${address}, tx: https://tracemove.io/transaction/${swap.txHash}`
      );

      //data[address].swap = data[address].swap ? data[address].swap! + 1 : 1;

      data[address] = {
        ...data[address],
        swap: data[address]?.swap ? data[address].swap! + 1 : 1,
      };
    } else if (randomAction === 'lend') {
      swap = await abelLendAsset(pk, tokenFromName);

      console.log(`Successfully lent ${tokenFromName} on Abel for address: ${address}, tx: ${swap.txHash} \n`);

      await sendTelegramMessage(
        `✅ Successfully lent ${tokenFromName} on Abel for address: ${address}, tx: https://tracemove.io/transaction/${swap.txHash}`
      );

      //data[address].lend = data[address].lend ? data[address].lend! + 1 : 1;

      data[address] = {
        ...data[address],
        lend: data[address]?.lend ? data[address].lend! + 1 : 1,
      };
    } else  {
      if(!balancesKeys.includes('USDC') && balances['USDC'] < MIN_AMOUNTS['USDC']) {
        continue;
      }

      swap = await thalaMintMod(pk);

      console.log(`Successfully minted MOD using USDC on Thala for address: ${address}, tx: ${swap.txHash} \n`);

      await sendTelegramMessage(
        `✅ Successfully minted MOD using USDC on Thala for address: ${address}, tx: https://tracemove.io/transaction/${swap.txHash}`
      );

      // data[address].stableMint = data[address].stableMint ? data[address].stableMint! + 1 : 1;
      data[address] = {
        ...data[address],
        stableMint: data[address]?.stableMint ? data[address].stableMint! + 1 : 1,
      };
    }

    if (!swap.result) {
      console.log('Swap failed for address: ' + address);

      data[address].balances = balances;

      continue;
    }

    // data[address].address = address;
    // data[address].transactions =  data[address]?.transactions ? data[address].transactions! + 1 : 1;
    // data[address].totalVolume = data[address]?.totalVolume ? data[address].totalVolume! + Number((swap.totalVolume)?.toFixed(2)) : Number((swap.totalVolume)?.toFixed(2));
    // data[address].balances;

    data[address] = {
      ...data[address],
      address,
      transactions: data[address]?.transactions ? data[address].transactions! + 1 : 1,
      totalVolume: data[address]?.totalVolume ? data[address].totalVolume! + Number((swap.totalVolume)?.toFixed(2)) : Number((swap.totalVolume)?.toFixed(2)),
      balances,
    };


    await sleep({ minutes: MIN_WAIT_TIME }, { minutes: MAX_WAIT_TIME });
  }
}

// catching ctrl+c event
process.on('SIGINT', function() {
  console.log('Caught interrupt signal');

  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync('walletsData.json', jsonData);

  process.exit();
});

// catching unhandled promise rejection
process.on('unhandledRejection', (reason, promise) => {
  console.log('Unhandled Rejection at:', promise, 'reason:', reason);

  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync('walletsData.json', jsonData);

  process.exit();
});

// catching uncaught exception
process.on('uncaughtException', (err, origin) => {
  console.log(`Caught exception: ${err}\n Exception origin: ${origin}`)

  const jsonData = JSON.stringify(data, null, 2);
  fs.writeFileSync('walletsData.json', jsonData);

  process.exit();
});

main();
