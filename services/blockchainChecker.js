const axios = require('axios');
const { query } = require('../database');
const config = require('../config');
const userService = require('./userService');
const financeService = require('./financeService');

/**
 * Simple deposit detector.
 * In production you would use webhooks (TronGrid, Alchemy, etc.)
 * or dedicated monitoring services.
 * This polls common explorers for incoming txs to treasury addresses.
 */

async function checkTrc20Usdt() {
  const address = config.treasury.usdtTrc20;
  if (!address) return [];

  try {
    const url = `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`;
    const headers = config.trongridKey ? { 'TRON-PRO-API-KEY': config.trongridKey } : {};
    const { data } = await axios.get(url, {
      headers,
      params: { only_to: true, limit: 50, contract_address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t' }, // USDT
      timeout: 10000,
    });

    const txs = data?.data || [];
    const newDeposits = [];

    for (const tx of txs) {
      const hash = tx.transaction_id;
      const exists = await query(`SELECT id FROM deposits WHERE tx_hash = $1`, [hash]);
      if (exists.rows[0]) continue;

      const amountRaw = Number(tx.value) / 1e6; // USDT 6 decimals
      if (amountRaw < 0.5) continue; // dust filter

      // Try to match user by memo or recent activity (simplified: use from address mapping or require memo)
      // For simplicity we store as pending and admin/CMS can assign, or use a tag system.
      // Here we look for a user who has this as pending or use a simple "last active + amount" heuristic.
      // Better: require users to include their telegram id in memo if the chain supports it.
      // TRC20 transfer memo is possible via contract.

      newDeposits.push({
        chain: 'usdt_trc20',
        tx_hash: hash,
        amount_crypto: amountRaw,
        from: tx.from,
        raw: tx,
      });
    }
    return newDeposits;
  } catch (e) {
    console.error('TRC20 check error', e.message);
    return [];
  }
}

async function checkErc20Usdt() {
  const address = config.treasury.usdtErc20;
  if (!address || !config.etherscanKey) return [];

  try {
    // USDT contract on Ethereum
    const contract = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
    const url = 'https://api.etherscan.io/api';
    const { data } = await axios.get(url, {
      params: {
        module: 'account',
        action: 'tokentx',
        contractaddress: contract,
        address,
        page: 1,
        offset: 50,
        sort: 'desc',
        apikey: config.etherscanKey,
      },
      timeout: 10000,
    });

    const txs = data?.result || [];
    const newDeposits = [];

    for (const tx of txs) {
      if (tx.to.toLowerCase() !== address.toLowerCase()) continue;
      const hash = tx.hash;
      const exists = await query(`SELECT id FROM deposits WHERE tx_hash = $1`, [hash]);
      if (exists.rows[0]) continue;

      const amountRaw = Number(tx.value) / 1e6;
      if (amountRaw < 0.5) continue;

      newDeposits.push({
        chain: 'usdt_erc20',
        tx_hash: hash,
        amount_crypto: amountRaw,
        from: tx.from,
        raw: tx,
      });
    }
    return newDeposits;
  } catch (e) {
    console.error('ERC20 check error', e.message);
    return [];
  }
}

/**
 * Process a detected deposit.
 * Because we don't have perfect user matching without memo,
 * we create a pending deposit that admin can confirm & credit,
 * OR we can implement a "claim deposit" flow where user submits tx hash.
 */
async function processDetectedDeposit(dep) {
  const rates = await financeService.getRates();
  let amountUsd = dep.amount_crypto;
  if (dep.chain.startsWith('usdt')) amountUsd = dep.amount_crypto * rates.usdt;
  else if (dep.chain === 'btc') amountUsd = dep.amount_crypto * rates.btc;
  else if (dep.chain === 'eth') amountUsd = dep.amount_crypto * rates.eth;
  else if (dep.chain === 'trx') amountUsd = dep.amount_crypto * rates.trx;

  // Insert as pending (no user yet) – admin assigns or user claims by tx hash
  await query(
    `INSERT INTO deposits (user_id, chain, tx_hash, amount_crypto, amount_usd, rate_usd, status, raw_data)
     VALUES (0, $1, $2, $3, $4, $5, 'pending', $6)
     ON CONFLICT (tx_hash) DO NOTHING`,
    [dep.chain, dep.tx_hash, dep.amount_crypto, amountUsd, rates.usdt || 1, dep.raw]
  );
}

/**
 * User claims a deposit by submitting tx hash
 */
async function claimDeposit(telegramId, txHash) {
  const res = await query(
    `SELECT * FROM deposits WHERE tx_hash = $1 AND status = 'pending' AND (user_id = 0 OR user_id = $2)`,
    [txHash, telegramId]
  );
  if (!res.rows[0]) {
    throw new Error('Transaction not found or already claimed. Make sure you sent to the correct address and wait a few minutes.');
  }
  const dep = res.rows[0];

  if (Number(dep.amount_usd) < config.minDepositUsd) {
    throw new Error(`Minimum deposit is $${config.minDepositUsd}`);
  }

  await query(
    `UPDATE deposits SET user_id = $1, status = 'confirmed', confirmed_at = NOW() WHERE id = $2`,
    [telegramId, dep.id]
  );

  await userService.creditBalance(telegramId, Number(dep.amount_usd), 'deposit', dep.id, {
    chain: dep.chain,
    tx_hash: dep.tx_hash,
  });

  await query(
    `UPDATE users SET total_deposited = total_deposited + $1 WHERE telegram_id = $2`,
    [dep.amount_usd, telegramId]
  );

  // Referral first deposit bonus already handled in welcome; optional extra
  return dep;
}

async function runDepositChecker() {
  console.log('[checker] Scanning for deposits...');
  const trc = await checkTrc20Usdt();
  const erc = await checkErc20Usdt();
  const all = [...trc, ...erc];
  for (const d of all) {
    await processDetectedDeposit(d);
  }
  console.log(`[checker] Found ${all.length} new potential deposits`);
  return all.length;
}

module.exports = {
  checkTrc20Usdt,
  checkErc20Usdt,
  processDetectedDeposit,
  claimDeposit,
  runDepositChecker,
};
