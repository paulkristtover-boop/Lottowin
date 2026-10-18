/**
 * Native TRX (Tron) + ETH (Ethereum) deposits via unique amount.
 * App balance stays in USD; rates from env for conversion.
 */
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const userService = require('./userService');
const { query } = require('../database');
const logger = require('../utils/logger');
const { formatUsd } = require('../utils/helpers');

const DEPOSIT_TTL_MS = 20 * 60 * 1000;
const processedHashes = new Set();

function normalizeNetwork(network) {
  const x = String(network || '').toLowerCase();
  if (x === 'trx' || x === 'tron' || x === 'trc') return 'trx';
  if (x === 'eth' || x === 'ethereum' || x === 'erc') return 'eth';
  // legacy map → reject USDT paths
  if (x.includes('usdt') || x === 'trc20' || x === 'erc20' || x === 'sol') {
    return x.includes('trc') || x === 'trc20' ? 'trx' : x.includes('erc') || x === 'erc20' ? 'eth' : 'trx';
  }
  return x;
}

function networkLabel(network) {
  return normalizeNetwork(network) === 'eth' ? 'ETH (Ethereum)' : 'TRX (Tron)';
}

function assetSymbol(network) {
  return normalizeNetwork(network) === 'eth' ? 'ETH' : 'TRX';
}

function getMasterAddress(network) {
  const n = normalizeNetwork(network);
  if (n === 'eth') {
    return process.env.ETH_MASTER_ADDRESS || process.env.ERC20_MASTER_ADDRESS || config.treasury?.eth || '';
  }
  return process.env.TRX_MASTER_ADDRESS || process.env.TRC20_MASTER_ADDRESS || config.treasury?.trx || '';
}

/** USD per 1 TRX / 1 ETH — set in env; used only for display conversion */
function getRateUsd(network) {
  const n = normalizeNetwork(network);
  if (n === 'eth') {
    return parseFloat(process.env.ETH_USD_RATE || config.ethUsdRate || '3000') || 3000;
  }
  return parseFloat(process.env.TRX_USD_RATE || config.trxUsdRate || '0.12') || 0.12;
}

function chainKeyForDb(network) {
  return normalizeNetwork(network) === 'eth' ? 'eth' : 'trx';
}

function toCryptoDecimals(n, network) {
  const ntw = normalizeNetwork(network);
  // ETH: 8 dp display uniqueness; TRX: 6 dp
  const f = ntw === 'eth' ? 1e8 : 1e6;
  return Math.round(Number(n) * f) / f;
}

function toSixDecimals(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

function usdToCrypto(usd, network) {
  const rate = getRateUsd(network);
  if (rate <= 0) throw new Error('Rate not configured');
  return toCryptoDecimals(Number(usd) / rate, network);
}

function cryptoToUsd(amount, network) {
  return toSixDecimals(Number(amount) * getRateUsd(network));
}

async function purgeExpiredDb() {
  try {
    await query(
      `UPDATE deposit_intents SET status = 'expired'
       WHERE status = 'pending' AND expires_at <= NOW()`
    );
  } catch (e) {
    logger.warn('purgeExpiredDb', e.message);
  }
}

async function generateUniqueCryptoAmount(baseCrypto, network) {
  const base = toCryptoDecimals(baseCrypto, network);
  await purgeExpiredDb();
  const step = normalizeNetwork(network) === 'eth' ? 1e-8 : 1e-6;

  for (let attempt = 0; attempt < 120; attempt++) {
    const modifier = (Math.floor(Math.random() * 9000) + 1) * step;
    const exact = toCryptoDecimals(base + modifier, network);
    try {
      const res = await query(
        `SELECT id FROM deposit_intents
         WHERE status = 'pending' AND expires_at > NOW()
           AND network = $2
           AND ABS(exact_amount - $1::numeric) < $3
         LIMIT 1`,
        [exact, normalizeNetwork(network), step / 2]
      );
      if (!res.rows[0]) return exact;
    } catch {
      return exact;
    }
  }
  throw new Error('Could not allocate unique amount. Try again.');
}

/**
 * @param {number} baseUsd - USD credit user wants
 */
async function createPendingDeposit(userId, network, baseUsd) {
  network = normalizeNetwork(network);
  const master = getMasterAddress(network);
  if (!master) throw new Error(`${networkLabel(network)} deposit address not configured`);

  const min = config.minDepositUsd || 1;
  if (Number(baseUsd) < min) {
    throw new Error(`Minimum deposit is ${formatUsd(min)}`);
  }

  try {
    await query(
      `UPDATE deposit_intents SET status = 'cancelled'
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );
  } catch (e) {
    logger.warn('cancel prior intents', e.message);
  }

  const baseCrypto = usdToCrypto(baseUsd, network);
  const exactCrypto = await generateUniqueCryptoAmount(baseCrypto, network);
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + DEPOSIT_TTL_MS);

  await query(
    `INSERT INTO deposit_intents (id, user_id, network, exact_amount, base_amount, expires_at, status)
     VALUES ($1::uuid, $2, $3, $4, $5, $6, 'pending')`,
    [id, userId, network, exactCrypto, toSixDecimals(baseUsd), expiresAt]
  );

  return {
    id,
    userId: Number(userId),
    network,
    symbol: assetSymbol(network),
    exactAmount: exactCrypto, // crypto to send
    baseAmount: toSixDecimals(baseUsd), // USD credit
    rate: getRateUsd(network),
    expiresAt: expiresAt.getTime(),
    masterAddress: master,
  };
}

async function getPendingForUser(userId) {
  await purgeExpiredDb();
  try {
    const res = await query(
      `SELECT * FROM deposit_intents
       WHERE user_id = $1 AND status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      userId: Number(r.user_id),
      network: normalizeNetwork(r.network),
      symbol: assetSymbol(r.network),
      exactAmount: Number(r.exact_amount),
      baseAmount: Number(r.base_amount),
      expiresAt: new Date(r.expires_at).getTime(),
      masterAddress: getMasterAddress(r.network),
      rate: getRateUsd(r.network),
    };
  } catch {
    return null;
  }
}

async function markIntentMatched(intentId, txHash) {
  await query(
    `UPDATE deposit_intents SET status = 'matched', matched_tx = $2, matched_at = NOW()
     WHERE id = $1::uuid AND status = 'pending'`,
    [intentId, txHash]
  );
}

async function isHashProcessed(hash) {
  if (!hash) return true;
  if (processedHashes.has(hash)) return true;
  try {
    const res = await query(`SELECT 1 FROM processed_tx_hashes WHERE tx_hash = $1 LIMIT 1`, [hash]);
    if (res.rows[0]) {
      processedHashes.add(hash);
      return true;
    }
  } catch (_) {}
  return false;
}

async function markHashProcessed(hash) {
  if (!hash) return;
  processedHashes.add(hash);
  try {
    await query(
      `INSERT INTO processed_tx_hashes (tx_hash) VALUES ($1) ON CONFLICT DO NOTHING`,
      [hash]
    );
  } catch (_) {}
}

/** Tron native TRX transfers to master */
async function fetchTrxIncoming(master) {
  const key = process.env.TRONGRID_API_KEY || process.env.TRONSCAN_API_KEY || '';
  const headers = key ? { 'TRON-PRO-API-KEY': key } : {};
  const out = [];
  try {
    // TronGrid: account transactions
    const url = `https://api.trongrid.io/v1/accounts/${master}/transactions?only_to=true&limit=40`;
    const { data } = await axios.get(url, { headers, timeout: 20000 });
    for (const tx of data?.data || []) {
      try {
        if (tx.ret?.[0]?.contractRet !== 'SUCCESS') continue;
        const c = tx.raw_data?.contract?.[0];
        if (!c || c.type !== 'TransferContract') continue;
        const val = c.parameter?.value;
        if (!val) continue;
        const to = val.to_address;
        // addresses may be hex; skip strict check if amount present
        const sun = Number(val.amount) || 0;
        if (sun <= 0) continue;
        const trx = sun / 1e6;
        const hash = tx.txID || tx.transaction_id;
        out.push({ hash, amount: trx, success: true });
      } catch (_) {}
    }
  } catch (e) {
    logger.warn('TRX fetch', e.message);
  }
  return out;
}

/** Ethereum native ETH transfers to master */
async function fetchEthIncoming(master) {
  const key = process.env.ETHERSCAN_API_KEY || '';
  const out = [];
  try {
    const url =
      `https://api.etherscan.io/v2/api?chainid=1&module=account&action=txlist` +
      `&address=${master}&startblock=0&endblock=99999999&page=1&offset=40&sort=desc&apikey=${key}`;
    const { data } = await axios.get(url, { timeout: 20000 });
    const list = Array.isArray(data?.result) ? data.result : [];
    for (const tx of list) {
      if (String(tx.to || '').toLowerCase() !== master.toLowerCase()) continue;
      if (tx.isError === '1') continue;
      const eth = Number(tx.value) / 1e18;
      if (eth <= 0) continue;
      out.push({ hash: tx.hash, amount: eth, success: true });
    }
  } catch (e) {
    logger.warn('ETH fetch', e.message);
  }
  return out;
}

async function listPendingAll() {
  try {
    const res = await query(
      `SELECT * FROM deposit_intents WHERE status = 'pending' AND expires_at > NOW()`
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: Number(r.user_id),
      network: normalizeNetwork(r.network),
      exactAmount: Number(r.exact_amount),
      baseAmount: Number(r.base_amount),
    }));
  } catch {
    return [];
  }
}

async function creditIntent(bot, intent, hash) {
  if (await isHashProcessed(hash)) return false;
  await markHashProcessed(hash);
  try {
    await markIntentMatched(intent.id, hash);
  } catch (_) {}

  try {
    await userService.creditBalance(intent.userId, intent.baseAmount, 'deposit', hash, {
      network: intent.network,
      crypto: intent.exactAmount,
    });
  } catch (e) {
    // fallback simple credit
    await query(
      `UPDATE users SET balance_usd = balance_usd + $1, total_deposited = total_deposited + $1,
       updated_at = NOW() WHERE telegram_id = $2`,
      [intent.baseAmount, intent.userId]
    );
  }

  if (bot?.telegram) {
    try {
      await bot.telegram.sendMessage(
        intent.userId,
        `✅ *Deposit confirmed*\n\n` +
          `Received *${intent.exactAmount}* ${assetSymbol(intent.network)}\n` +
          `Credited *${formatUsd(intent.baseAmount)}*\n\n` +
          `Tx: \`${hash.slice(0, 12)}…\``,
        { parse_mode: 'Markdown' }
      );
    } catch (_) {}
  }
  return true;
}

function amountsMatch(got, need, network) {
  const n = normalizeNetwork(network);
  const eps = n === 'eth' ? 1.5e-8 : 1.5e-6;
  return Math.abs(Number(got) - Number(need)) <= eps;
}

async function scanAndCredit(bot) {
  await purgeExpiredDb();
  const pending = await listPendingAll();
  if (!pending.length) return { matched: 0 };

  let matched = 0;
  const byNet = { trx: [], eth: [] };
  for (const p of pending) {
    const n = normalizeNetwork(p.network);
    if (byNet[n]) byNet[n].push(p);
  }

  if (byNet.trx.length) {
    const master = getMasterAddress('trx');
    if (master) {
      const txs = await fetchTrxIncoming(master);
      for (const p of byNet.trx) {
        for (const tx of txs) {
          if (!amountsMatch(tx.amount, p.exactAmount, 'trx')) continue;
          if (await creditIntent(bot, p, tx.hash)) matched += 1;
          break;
        }
      }
    }
  }

  if (byNet.eth.length) {
    const master = getMasterAddress('eth');
    if (master) {
      const txs = await fetchEthIncoming(master);
      for (const p of byNet.eth) {
        for (const tx of txs) {
          if (!amountsMatch(tx.amount, p.exactAmount, 'eth')) continue;
          if (await creditIntent(bot, p, tx.hash)) matched += 1;
          break;
        }
      }
    }
  }

  return { matched, pending: pending.length };
}

function isValidEvmAddress(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function isValidTronAddress(addr) {
  return typeof addr === 'string' && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr.trim());
}

function validateWithdrawAddress(network, address) {
  const n = normalizeNetwork(network);
  if (n === 'eth') {
    if (!isValidEvmAddress(address)) throw new Error('Invalid ETH address (0x…)');
  } else if (n === 'trx') {
    if (!isValidTronAddress(address)) throw new Error('Invalid TRX address (starts with T)');
  } else {
    throw new Error('Use TRX or ETH only');
  }
  return address.trim();
}

function getWithdrawFeeUsd(network) {
  const n = normalizeNetwork(network);
  if (n === 'eth') {
    return parseFloat(process.env.WITHDRAW_FEE_ETH_USD || '3') || 3;
  }
  return parseFloat(process.env.WITHDRAW_FEE_TRX_USD || '1') || 1;
}

module.exports = {
  createPendingDeposit,
  getPendingForUser,
  scanAndCredit,
  markHashProcessed,
  isHashProcessed,
  getMasterAddress,
  normalizeNetwork,
  networkLabel,
  assetSymbol,
  chainKeyForDb,
  validateWithdrawAddress,
  getRateUsd,
  usdToCrypto,
  cryptoToUsd,
  getWithdrawFeeUsd,
  DEPOSIT_TTL_MS,
  processedHashes,
};
