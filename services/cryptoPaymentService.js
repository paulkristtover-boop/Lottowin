/**
 * USDT deposit (unique-amount matching) + withdrawal request helpers.
 * Explorer APIs only — no local nodes.
 *
 * Env (via config / process.env):
 *   ETHERSCAN_API_KEY, TRONSCAN_API_KEY (or TRONGRID_API_KEY)
 *   ERC20_MASTER_ADDRESS / USDT_ERC20_ADDRESS
 *   TRC20_MASTER_ADDRESS / USDT_TRC20_ADDRESS
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const userService = require('./userService');
const { query } = require('../database');
const logger = require('../utils/logger');

// ─── In-memory pending deposits ───────────────────────────────────────────
/** @type {Array<{id:string,userId:number,network:string,exactAmount:number,baseAmount:number,expiresAt:number,createdAt:number}>} */
const pendingDeposits = [];

/** @type {Set<string>} */
const processedHashes = new Set();

const USDT_ERC20_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
const DEPOSIT_TTL_MS = 15 * 60 * 1000;
const AMOUNT_EPS = 1e-8; // float compare tolerance for 6-decimal amounts

function getMasterAddress(network) {
  if (network === 'erc20' || network === 'usdt_erc20') {
    return (
      process.env.ERC20_MASTER_ADDRESS ||
      config.treasury.usdtErc20 ||
      ''
    );
  }
  if (network === 'trc20' || network === 'usdt_trc20') {
    return (
      process.env.TRC20_MASTER_ADDRESS ||
      config.treasury.usdtTrc20 ||
      ''
    );
  }
  return '';
}

function normalizeNetwork(network) {
  if (network === 'usdt_erc20' || network === 'erc20') return 'erc20';
  if (network === 'usdt_trc20' || network === 'trc20') return 'trc20';
  return network;
}

function toSixDecimals(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

/**
 * Generate unique exact amount = base + sub-cent modifier (6 decimals).
 * Unique among active (non-expired) pending deposits.
 */
function generateUniqueAmount(baseAmount) {
  const base = toSixDecimals(baseAmount);
  if (base < config.minDepositUsd) {
    throw new Error(`Minimum deposit is $${config.minDepositUsd}`);
  }

  // purge expired first
  purgeExpired();

  for (let attempt = 0; attempt < 80; attempt++) {
    // modifier in [0.000001, 0.009999] — keeps display as base.xxxxxx
    const modifier = Math.floor(Math.random() * 9999 + 1) / 1e6;
    const exact = toSixDecimals(base + modifier);
    const taken = pendingDeposits.some(
      (p) => Math.abs(p.exactAmount - exact) < AMOUNT_EPS && p.expiresAt > Date.now()
    );
    if (!taken) return exact;
  }
  throw new Error('Could not allocate a unique deposit amount. Try again in a moment.');
}

function purgeExpired() {
  const now = Date.now();
  for (let i = pendingDeposits.length - 1; i >= 0; i--) {
    if (pendingDeposits[i].expiresAt <= now) pendingDeposits.splice(i, 1);
  }
}

/**
 * Create or replace pending deposit for user on a network.
 */
function createPendingDeposit(userId, network, baseAmount) {
  network = normalizeNetwork(network);
  const master = getMasterAddress(network);
  if (!master) throw new Error('Deposit address not configured for this network');

  // Clear any existing pending for this user (keep pool clean)
  for (let i = pendingDeposits.length - 1; i >= 0; i--) {
    if (pendingDeposits[i].userId === userId) pendingDeposits.splice(i, 1);
  }

  const exactAmount = generateUniqueAmount(baseAmount);
  const rec = {
    id: uuidv4(),
    userId: Number(userId),
    network,
    exactAmount,
    baseAmount: toSixDecimals(baseAmount),
    expiresAt: Date.now() + DEPOSIT_TTL_MS,
    createdAt: Date.now(),
  };
  pendingDeposits.push(rec);
  return { ...rec, masterAddress: master };
}

function getPendingForUser(userId) {
  purgeExpired();
  return pendingDeposits.find((p) => p.userId === Number(userId)) || null;
}

function listPending() {
  purgeExpired();
  return [...pendingDeposits];
}

function removePending(id) {
  const idx = pendingDeposits.findIndex((p) => p.id === id);
  if (idx >= 0) pendingDeposits.splice(idx, 1);
}

async function markHashProcessed(hash, meta = {}) {
  if (!hash) return;
  processedHashes.add(hash);
  try {
    await query(
      `INSERT INTO deposits (user_id, chain, tx_hash, amount_crypto, amount_usd, rate_usd, status, confirmed_at, raw_data)
       VALUES ($1, $2, $3, $4, $5, 1, 'confirmed', NOW(), $6)
       ON CONFLICT (tx_hash) DO NOTHING`,
      [
        meta.userId || 0,
        meta.network || 'unknown',
        hash,
        meta.exactAmount || 0,
        meta.baseAmount || 0,
        meta.raw || null,
      ]
    );
  } catch (e) {
    logger.warn('markHashProcessed db', e.message);
  }
}

async function isHashProcessed(hash) {
  if (processedHashes.has(hash)) return true;
  try {
    const res = await query(`SELECT id FROM deposits WHERE tx_hash = $1`, [hash]);
    if (res.rows[0]) {
      processedHashes.add(hash);
      return true;
    }
  } catch {
    /* ignore */
  }
  return false;
}

// ─── Explorer fetchers ────────────────────────────────────────────────────

async function fetchErc20Incoming() {
  const address = getMasterAddress('erc20');
  const apiKey = process.env.ETHERSCAN_API_KEY || config.etherscanKey || '';
  if (!address || !apiKey) return [];

  try {
    const { data } = await axios.get('https://api.etherscan.io/api', {
      params: {
        module: 'account',
        action: 'tokentx',
        contractaddress: USDT_ERC20_CONTRACT,
        address,
        page: 1,
        offset: 40,
        sort: 'desc',
        apikey: apiKey,
      },
      timeout: 12000,
    });

    const rows = Array.isArray(data?.result) ? data.result : [];
    const out = [];
    for (const tx of rows) {
      if (!tx || tx.to?.toLowerCase() !== address.toLowerCase()) continue;
      // skip failed / error
      if (tx.txreceipt_status === '0') continue;
      const raw = tx.value;
      const amount = Number(raw) / 1e6; // USDT 6 decimals
      if (!Number.isFinite(amount) || amount <= 0) continue;
      out.push({
        hash: tx.hash,
        amount: toSixDecimals(amount),
        from: tx.from,
        network: 'erc20',
        raw: tx,
      });
    }
    return out;
  } catch (e) {
    logger.error('Etherscan fetch error', e.message);
    return [];
  }
}

async function fetchTrc20Incoming() {
  const address = getMasterAddress('trc20');
  if (!address) return [];

  const tronscanKey = process.env.TRONSCAN_API_KEY || '';
  const trongridKey = process.env.TRONGRID_API_KEY || config.trongridKey || '';

  // Prefer TronGrid account TRC20 transfers (reliable, free-tier friendly)
  try {
    const headers = {};
    if (trongridKey) headers['TRON-PRO-API-KEY'] = trongridKey;
    if (tronscanKey) headers['TRON-PRO-API-KEY'] = headers['TRON-PRO-API-KEY'] || tronscanKey;

    const { data } = await axios.get(
      `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`,
      {
        headers,
        params: {
          only_to: true,
          limit: 40,
          contract_address: USDT_TRC20_CONTRACT,
        },
        timeout: 12000,
      }
    );

    const rows = data?.data || [];
    const out = [];
    for (const tx of rows) {
      const hash = tx.transaction_id || tx.txID;
      if (!hash) continue;
      // type must be Transfer / incoming
      const rawVal = tx.value ?? tx.quant;
      const amount = Number(rawVal) / 1e6;
      if (!Number.isFinite(amount) || amount <= 0) continue;
      out.push({
        hash,
        amount: toSixDecimals(amount),
        from: tx.from || tx.from_address,
        network: 'trc20',
        raw: tx,
      });
    }
    return out;
  } catch (e) {
    logger.error('Tron TRC20 fetch error', e.message);
    return [];
  }
}

/**
 * Match chain txs against pending unique amounts and credit users.
 * @param {import('telegraf').Telegraf} bot
 */
async function scanAndCredit(bot) {
  purgeExpired();
  if (pendingDeposits.length === 0) return { matched: 0 };

  const [erc, trc] = await Promise.all([fetchErc20Incoming(), fetchTrc20Incoming()]);
  const txs = [...erc, ...trc];
  let matched = 0;

  for (const tx of txs) {
    if (await isHashProcessed(tx.hash)) continue;

    const pending = pendingDeposits.find(
      (p) =>
        p.network === tx.network &&
        p.expiresAt > Date.now() &&
        Math.abs(p.exactAmount - tx.amount) < AMOUNT_EPS
    );
    if (!pending) continue;

    // Credit baseAmount (user-intended), not the modifier dust
    try {
      await userService.creditBalance(pending.userId, pending.baseAmount, 'deposit', null, {
        network: pending.network,
        exactAmount: pending.exactAmount,
        tx_hash: tx.hash,
      });
      await query(
        `UPDATE users SET total_deposited = total_deposited + $1 WHERE telegram_id = $2`,
        [pending.baseAmount, pending.userId]
      ).catch(() => {});

      // Unlock welcome free tickets on first qualifying deposit
      let unlockInfo = { unlocked: 0 };
      try {
        unlockInfo = await require('./ticketCreditService').onSuccessfulDeposit(
          pending.userId,
          pending.baseAmount
        );
      } catch (e) {
        logger.error('ticket unlock', e.message);
      }

      await markHashProcessed(tx.hash, {
        userId: pending.userId,
        network: pending.network === 'erc20' ? 'usdt_erc20' : 'usdt_trc20',
        exactAmount: pending.exactAmount,
        baseAmount: pending.baseAmount,
        raw: tx.raw,
      });

      removePending(pending.id);
      matched += 1;

      if (bot?.telegram) {
        const netLabel = pending.network === 'erc20' ? 'USDT ERC-20' : 'USDT TRC-20';
        let extra = '';
        if (unlockInfo.unlocked > 0) {
          extra = `\n\n🎫 *${unlockInfo.unlocked} free welcome tickets unlocked!* Use them on Play.`;
        } else if (unlockInfo.firstDeposit) {
          extra = '\n\nFirst deposit recorded.';
        }
        await bot.telegram
          .sendMessage(
            pending.userId,
            `✅ *Deposit confirmed*\n\n` +
              `Network: ${netLabel}\n` +
              `Credited: *$${pending.baseAmount.toFixed(2)}*\n` +
              `TX: \`${tx.hash}\`` +
              extra,
            { parse_mode: 'Markdown' }
          )
          .catch(() => {});
      }

      logger.info('Deposit matched', {
        userId: pending.userId,
        amount: pending.baseAmount,
        hash: tx.hash,
      });
    } catch (e) {
      logger.error('Credit deposit failed', e.message);
    }
  }

  return { matched, scanned: txs.length, pending: pendingDeposits.length };
}

// ─── Address validation ───────────────────────────────────────────────────

function isValidEvmAddress(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function isValidTronAddress(addr) {
  return typeof addr === 'string' && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr.trim());
}

function validateWithdrawAddress(network, address) {
  const n = normalizeNetwork(network);
  if (n === 'erc20') {
    if (!isValidEvmAddress(address)) throw new Error('Invalid ERC-20 address (must start with 0x and be 42 chars)');
  } else if (n === 'trc20') {
    if (!isValidTronAddress(address)) throw new Error('Invalid TRC-20 address (must start with T)');
  } else {
    throw new Error('Unsupported network');
  }
  return address.trim();
}

module.exports = {
  createPendingDeposit,
  getPendingForUser,
  listPending,
  removePending,
  scanAndCredit,
  markHashProcessed,
  isHashProcessed,
  getMasterAddress,
  normalizeNetwork,
  validateWithdrawAddress,
  isValidEvmAddress,
  isValidTronAddress,
  pendingDeposits,
  processedHashes,
  DEPOSIT_TTL_MS,
};
