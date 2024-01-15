import { DECIMALS, Data } from "./AptosConstants";
import { shuffleArray } from "./Helpers";
import { pancakeAptosSwapTokens } from "./PancakeAptosService";
import { getAptosBalance, getAddress } from "./AptosHelpers";
import fs from 'fs';


let data: Record<string, Data> = {};
const MAX_TRANSACTIONS_PER_WALLET = 5;

async function main() {

  const pkArr = fs.readFileSync('keys.txt').toString().split('\n');

  if (fs.existsSync('walletsData.json')) {
    data = JSON.parse(fs.readFileSync('walletsData.json').toString());
  }

  while (true) {

    if (pkArr.length === 0) {
      console.log('No more private keys to use');
      fs.writeFileSync('walletsData.json', JSON.stringify(data, null, 2));
      return;
    }

    const pk = shuffleArray(pkArr)[0];
    const address = getAddress(pk);
    const balances = await getAptosBalance(pk);

    // check if max transactions reached
    if (data[address].transactions && data[address].transactions! >= MAX_TRANSACTIONS_PER_WALLET) {
      console.log('Max transactions reached for address: ' + address);

      pkArr.splice(pkArr.indexOf(pk), 1);

      data[address] = {
        address,
        balances,
      }

      continue;
    }

    // check if balance is too low
    if (balances['AptosCoin'] <  0.002) {
      console.log('AptosCoin balance is too low for address: ' + address);
      pkArr.splice(pkArr.indexOf(pk), 1);

      data[address] = {
        address,
        balances,
      }

      continue;
    }

    // random tokenFromName with balance > 0
    const balancesKeys = Object.keys(balances).filter(key => balances[key] !== 0);
    const tokenFromName = shuffleArray(balancesKeys)[0];

    // random tokenToName
    const tokenToName = shuffleArray(Object.keys(balances).filter(key => key !== tokenFromName))[0];

    let amountToSwap: number;
    if (tokenFromName === 'AptosCoin') {
      const maxSwapAmount = balances[tokenFromName] - 0.0015;
      const amountInWei = +maxSwapAmount.toFixed(6) * DECIMALS[tokenFromName];
      // number between 5 and 60
      const random = Math.floor(Math.random() * (70 - 10 + 1) + 10);
      amountToSwap = Math.floor(amountInWei / 100 * random);
    } else {
      const balanceInWei = +balances[tokenFromName].toFixed(6) * DECIMALS[tokenFromName];
      // number between 5 and 100
      const random = Math.floor(Math.random() * (100 - 5 + 1) + 5);
      amountToSwap = Math.floor(balanceInWei / 100 * random);
    }

    const swap = await pancakeAptosSwapTokens(pk, tokenFromName, tokenToName, amountToSwap);

    if (!swap.result) {
      console.log('Swap failed for address: ' + address);

      data[address] = {
        address,
        balances,
      }

      continue;
    }

    console.log(`Successfully swapped ${amountToSwap} ${tokenFromName} to ${tokenToName} for address: ${address}, tx: ${swap.txHash}`);

    data[address] = {
      address,
      transactions: data[address].transactions ? data[address].transactions! + 1 : 1,
      totalVolume: data[address].totalVolume ? data[address].totalVolume! + swap.totalVolume! : swap.totalVolume,
      balances,
    }

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