/**
 * USDT deposits (unique-amount) + helpers.
 * TRC-20 (Tron) + ERC-20 (Ethereum) + Solana (SPL) via explorers/APIs.
 * Intents persisted in deposit_intents so restarts do not drop pending deposits.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const userService = require('./userService');
const { query } = require('../database');
const logger = require('../utils/logger');
const { formatUsd } = require('../utils/helpers');

const USDT_ERC20_CONTRACT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const USDT_TRC20_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';
/** Official SPL USDT mint (mainnet) — 6 decimals */
const USDT_SOL_MINT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';
const DEPOSIT_TTL_MS = 15 * 60 * 1000;
const AMOUNT_EPS = 1e-6; // 6dp USDT — 1 unit of 6th decimal

const processedHashes = new Set();

function getMasterAddress(network) {
  const n = normalizeNetwork(network);
  if (n === 'erc20') {
    return process.env.ERC20_MASTER_ADDRESS || config.treasury?.usdtErc20 || '';
  }
  if (n === 'trc20') {
    return process.env.TRC20_MASTER_ADDRESS || config.treasury?.usdtTrc20 || '';
  }
  if (n === 'sol') {
    return process.env.SOL_MASTER_ADDRESS || process.env.USDT_SOL_ADDRESS || config.treasury?.usdtSol || '';
  }
  return '';
}

function normalizeNetwork(network) {
  const x = String(network || '').toLowerCase();
  if (x === 'usdt_erc20' || x === 'erc20') return 'erc20';
  if (x === 'usdt_trc20' || x === 'trc20') return 'trc20';
  if (x === 'usdt_sol' || x === 'sol' || x === 'solana' || x === 'spl') return 'sol';
  return x;
}

function networkLabel(network) {
  const n = normalizeNetwork(network);
  if (n === 'erc20') return 'USDT ERC-20';
  if (n === 'sol') return 'USDT Solana';
  return 'USDT TRC-20';
}

function chainKeyForDb(network) {
  const n = normalizeNetwork(network);
  if (n === 'erc20') return 'usdt_erc20';
  if (n === 'sol') return 'usdt_sol';
  return 'usdt_trc20';
}

function toSixDecimals(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
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

async function generateUniqueAmount(baseAmount) {
  const base = toSixDecimals(baseAmount);
  if (base < config.minDepositUsd) {
    throw new Error(`Minimum deposit is ${formatUsd(config.minDepositUsd)}`);
  }
  await purgeExpiredDb();

  for (let attempt = 0; attempt < 100; attempt++) {
    const modifier = Math.floor(Math.random() * 9999 + 1) / 1e6;
    const exact = toSixDecimals(base + modifier);
    try {
      const res = await query(
        `SELECT id FROM deposit_intents
         WHERE status = 'pending' AND expires_at > NOW()
           AND ABS(exact_amount - $1::numeric) < 0.0000005
         LIMIT 1`,
        [exact]
      );
      if (!res.rows[0]) return exact;
    } catch {
      return exact; // table missing — still allow in-memory-less path
    }
  }
  throw new Error('Could not allocate a unique deposit amount. Try again.');
}

async function createPendingDeposit(userId, network, baseAmount) {
  network = normalizeNetwork(network);
  const master = getMasterAddress(network);
  if (!master) throw new Error('Deposit address not configured for this network');

  // Cancel other open intents for this user
  try {
    await query(
      `UPDATE deposit_intents SET status = 'cancelled'
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );
  } catch (e) {
    logger.warn('cancel prior intents', e.message);
  }

  const exactAmount = await generateUniqueAmount(baseAmount);
  const id = uuidv4();
  const expiresAt = new Date(Date.now() + DEPOSIT_TTL_MS);

  try {
    await query(
      `INSERT INTO deposit_intents (id, user_id, network, exact_amount, base_amount, expires_at, status)
       VALUES ($1::uuid, $2, $3, $4, $5, $6, 'pending')`,
      [id, userId, network, exactAmount, toSixDecimals(baseAmount), expiresAt]
    );
  } catch (e) {
    logger.error('insert deposit_intent', e.message);
    throw new Error(
      'Deposit system needs DB migration (deposit_intents). Run scripts/migrate-deposit-intents.sql'
    );
  }

  return {
    id,
    userId: Number(userId),
    network,
    exactAmount,
    baseAmount: toSixDecimals(baseAmount),
    expiresAt: expiresAt.getTime(),
    createdAt: Date.now(),
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
    const r = res.rows[0];
    if (!r) return null;
    return {
      id: r.id,
      userId: Number(r.user_id),
      network: r.network,
      exactAmount: Number(r.exact_amount),
      baseAmount: Number(r.base_amount),
      expiresAt: new Date(r.expires_at).getTime(),
      masterAddress: getMasterAddress(r.network),
    };
  } catch {
    return null;
  }
}

async function listPending() {
  await purgeExpiredDb();
  try {
    const res = await query(
      `SELECT * FROM deposit_intents
       WHERE status = 'pending' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 50`
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: Number(r.user_id),
      network: r.network,
      exactAmount: Number(r.exact_amount),
      baseAmount: Number(r.base_amount),
      expiresAt: new Date(r.expires_at).getTime(),
    }));
  } catch {
    return [];
  }
}

async function loadActivePending() {
  try {
    const res = await query(
      `SELECT * FROM deposit_intents
       WHERE status = 'pending' AND expires_at > NOW()`
    );
    return res.rows.map((r) => ({
      id: r.id,
      userId: Number(r.user_id),
      network: r.network,
      exactAmount: Number(r.exact_amount),
      baseAmount: Number(r.base_amount),
      expiresAt: new Date(r.expires_at).getTime(),
    }));
  } catch (e) {
    logger.warn('loadActivePending', e.message);
    return [];
  }
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
        meta.raw ? JSON.stringify(meta.raw) : null,
      ]
    );
  } catch (e) {
    logger.warn('markHashProcessed', e.message);
  }
}

async function isHashProcessed(hash) {
  if (!hash) return true;
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

function parseTokenAmount(value, decimals = 6) {
  // Etherscan returns integer string in token smallest units
  const s = String(value);
  if (s.includes('.')) return toSixDecimals(parseFloat(s));
  const neg = s.startsWith('-');
  const digits = neg ? s.slice(1) : s;
  const pad = digits.padStart(decimals + 1, '0');
  const whole = pad.slice(0, -decimals) || '0';
  const frac = pad.slice(-decimals);
  return toSixDecimals(parseFloat(`${neg ? '-' : ''}${whole}.${frac}`));
}

async function fetchErc20Incoming() {
  const address = getMasterAddress('erc20');
  const apiKey = process.env.ETHERSCAN_API_KEY || config.etherscanKey || '';
  if (!address) {
    logger.warn('ERC20 master address not set');
    return [];
  }
  if (!apiKey) {
    logger.warn('ETHERSCAN_API_KEY not set — ERC20 deposits will not detect');
    return [];
  }

  const tryUrls = [
    // V2 style (chainid=1 Ethereum)
    {
      url: 'https://api.etherscan.io/v2/api',
      params: {
        chainid: 1,
        module: 'account',
        action: 'tokentx',
        contractaddress: USDT_ERC20_CONTRACT,
        address,
        page: 1,
        offset: 50,
        sort: 'desc',
        apikey: apiKey,
      },
    },
    // Classic V1
    {
      url: 'https://api.etherscan.io/api',
      params: {
        module: 'account',
        action: 'tokentx',
        contractaddress: USDT_ERC20_CONTRACT,
        address,
        page: 1,
        offset: 50,
        sort: 'desc',
        apikey: apiKey,
      },
    },
  ];

  for (const attempt of tryUrls) {
    try {
      const { data } = await axios.get(attempt.url, {
        params: attempt.params,
        timeout: 15000,
      });

      if (data?.status === '0' && typeof data?.result === 'string') {
        logger.warn('Etherscan message', data.result);
        continue;
      }

      const rows = Array.isArray(data?.result) ? data.result : [];
      const out = [];
      const master = address.toLowerCase();

      for (const tx of rows) {
        if (!tx || !tx.hash) continue;
        if (String(tx.to || '').toLowerCase() !== master) continue;
        if (String(tx.contractAddress || '').toLowerCase() !== USDT_ERC20_CONTRACT.toLowerCase()) {
          continue;
        }
        const decimals = parseInt(tx.tokenDecimal || '6', 10) || 6;
        const amount = parseTokenAmount(tx.value, decimals);
        if (amount <= 0) continue;
        out.push({
          hash: tx.hash,
          amount: toSixDecimals(amount),
          from: tx.from,
          network: 'erc20',
          raw: tx,
        });
      }
      logger.info('Etherscan USDT txs', { count: out.length, via: attempt.url });
      return out;
    } catch (e) {
      logger.error('Etherscan fetch error', e.message);
    }
  }
  return [];
}

async function fetchTrc20Incoming() {
  const address = getMasterAddress('trc20');
  if (!address) return [];

  const trongridKey = process.env.TRONGRID_API_KEY || config.trongridKey || '';
  const tronscanKey = process.env.TRONSCAN_API_KEY || '';

  // Prefer TronGrid
  try {
    const headers = {};
    if (trongridKey) headers['TRON-PRO-API-KEY'] = trongridKey;
    const { data } = await axios.get(
      `https://api.trongrid.io/v1/accounts/${address}/transactions/trc20`,
      {
        params: {
          limit: 50,
          contract_address: USDT_TRC20_CONTRACT,
          only_to: true,
        },
        headers,
        timeout: 15000,
      }
    );
    const rows = data?.data || [];
    const out = [];
    for (const tx of rows) {
      if (String(tx.to || '').toLowerCase() !== address.toLowerCase() && tx.to !== address) {
        // Tron addresses are case-sensitive base58 — compare as-is too
        if (tx.to !== address) continue;
      }
      const decimals = Number(tx.token_info?.decimals ?? 6);
      const amount = parseTokenAmount(tx.value, decimals);
      if (amount <= 0) continue;
      out.push({
        hash: tx.transaction_id || tx.hash,
        amount: toSixDecimals(amount),
        from: tx.from,
        network: 'trc20',
        raw: tx,
      });
    }
    return out;
  } catch (e) {
    logger.error('TronGrid TRC20 fetch error', e.message);
  }

  // Fallback Tronscan
  try {
    const { data } = await axios.get('https://apilist.tronscanapi.com/api/token_trc20/transfers', {
      params: {
        relatedAddress: address,
        contract_address: USDT_TRC20_CONTRACT,
        limit: 50,
        start: 0,
        sort: '-timestamp',
        count: true,
        filterTokenValue: 1,
      },
      headers: tronscanKey ? { 'TRON-PRO-API-KEY': tronscanKey } : {},
      timeout: 15000,
    });
    const rows = data?.token_transfers || data?.data || [];
    const out = [];
    for (const tx of rows) {
      if (tx.to_address !== address) continue;
      const amount = toSixDecimals(Number(tx.quant || tx.amount || 0) / 1e6);
      if (amount <= 0) continue;
      out.push({
        hash: tx.transaction_id,
        amount,
        from: tx.from_address,
        network: 'trc20',
        raw: tx,
      });
    }
    return out;
  } catch (e) {
    logger.error('Tronscan TRC20 fetch error', e.message);
    return [];
  }
}

async function creditMatched(bot, pending, tx) {
  await userService.creditBalance(pending.userId, pending.baseAmount, 'deposit', null, {
    network: pending.network,
    exactAmount: pending.exactAmount,
    tx_hash: tx.hash,
  });
  await query(
    `UPDATE users SET total_deposited = COALESCE(total_deposited,0) + $1 WHERE telegram_id = $2`,
    [pending.baseAmount, pending.userId]
  ).catch(() => {});

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
    network: chainKeyForDb(pending.network),
    exactAmount: pending.exactAmount,
    baseAmount: pending.baseAmount,
    raw: tx.raw,
  });

  await query(
    `UPDATE deposit_intents SET status = 'matched', tx_hash = $2 WHERE id = $1::uuid`,
    [pending.id, tx.hash]
  ).catch(() => {});

  if (bot?.telegram) {
    const netLabel = networkLabel(pending.network);
    let extra = '';
    if (unlockInfo.unlocked > 0) {
      extra = `\n\n🎫 *${unlockInfo.unlocked} free welcome tickets unlocked!*`;
    }
    await bot.telegram
      .sendMessage(
        pending.userId,
        `✅ *Deposit confirmed*\n\nNetwork: ${netLabel}\nCredited: *${formatUsd(pending.baseAmount)}*\nTX: \`${tx.hash}\`${extra}`,
        { parse_mode: 'Markdown' }
      )
      .catch(() => {});
    for (const adminId of config.adminIds || []) {
      await bot.telegram
        .sendMessage(
          adminId,
          `💰 Deposit ${netLabel}\nUser: ${pending.userId}\n${formatUsd(pending.baseAmount)}\n\`${tx.hash}\``,
          { parse_mode: 'Markdown' }
        )
        .catch(() => {});
    }
  }

  logger.info('Deposit matched', {
    userId: pending.userId,
    amount: pending.baseAmount,
    hash: tx.hash,
  });
}

async function scanAndCredit(bot) {
  await purgeExpiredDb();
  const pendingList = await loadActivePending();
  if (pendingList.length === 0) {
    return { matched: 0, scanned: 0, pending: 0 };
  }

  const [erc, trc, sol] = await Promise.all([
    fetchErc20Incoming(),
    fetchTrc20Incoming(),
    fetchSolIncoming(),
  ]);
  const txs = [...erc, ...trc, ...sol];
  let matched = 0;

  for (const tx of txs) {
    if (await isHashProcessed(tx.hash)) continue;

    const pending = pendingList.find(
      (p) =>
        p.network === tx.network &&
        p.expiresAt > Date.now() &&
        Math.abs(p.exactAmount - tx.amount) <= AMOUNT_EPS
    );
    if (!pending) continue;

    try {
      await creditMatched(bot, pending, tx);
      matched += 1;
      // remove from local list
      const idx = pendingList.findIndex((p) => p.id === pending.id);
      if (idx >= 0) pendingList.splice(idx, 1);
    } catch (e) {
      logger.error('Credit deposit failed', e.message);
    }
  }

  return { matched, scanned: txs.length, pending: pendingList.length };
}

/**
 * Manual credit when auto-match failed (admin).
 * amountUsd = base credit; optional exact for bookkeeping.
 */
async function manualCreditDeposit(userId, amountUsd, network, txHash) {
  network = normalizeNetwork(network);
  if (txHash && (await isHashProcessed(txHash))) {
    throw new Error('This TX hash was already credited');
  }
  const amount = toSixDecimals(amountUsd);
  if (amount <= 0) throw new Error('Invalid amount');

  await userService.creditBalance(userId, amount, 'deposit', null, {
    network,
    tx_hash: txHash || null,
    manual: true,
  });
  await query(
    `UPDATE users SET total_deposited = COALESCE(total_deposited,0) + $1 WHERE telegram_id = $2`,
    [amount, userId]
  ).catch(() => {});

  if (txHash) {
    await markHashProcessed(txHash, {
      userId,
      network: chainKeyForDb(network),
      exactAmount: amount,
      baseAmount: amount,
    });
  }

  try {
    await require('./ticketCreditService').onSuccessfulDeposit(userId, amount);
  } catch {
    /* ignore */
  }

  // close open intents for user
  await query(
    `UPDATE deposit_intents SET status = 'matched', tx_hash = COALESCE($2, tx_hash)
     WHERE user_id = $1 AND status = 'pending'`,
    [userId, txHash || null]
  ).catch(() => {});

  return amount;
}

/**
 * Incoming SPL USDT to master. Prefer Helius; optional Solscan-style fallback.
 * Returns [{ hash, amount, network: 'sol', raw }]
 */
async function fetchSolIncoming() {
  const address = getMasterAddress('sol');
  if (!address) return [];

  const heliusKey = process.env.HELIUS_API_KEY || config.heliusApiKey || '';
  const out = [];

  if (heliusKey) {
    try {
      const url = `https://api.helius.xyz/v0/addresses/${address}/transactions`;
      const { data } = await axios.get(url, {
        params: { 'api-key': heliusKey, limit: 40, type: 'TRANSFER' },
        timeout: 12000,
      });
      const list = Array.isArray(data) ? data : [];
      for (const tx of list) {
        const sig = tx.signature || tx.txHash || tx.hash;
        if (!sig) continue;
        const transfers = tx.tokenTransfers || tx.events?.token || [];
        for (const t of transfers) {
          const mint = t.mint || t.tokenAddress || '';
          if (mint !== USDT_SOL_MINT) continue;
          const to = (t.toUserAccount || t.to || t.destination || '').toString();
          if (to && to !== address) continue;
          let amount = Number(t.tokenAmount ?? t.amount ?? 0);
          if (t.rawTokenAmount?.tokenAmount != null) {
            const dec = Number(t.rawTokenAmount.decimals ?? 6);
            amount = Number(t.rawTokenAmount.tokenAmount) / 10 ** dec;
          }
          amount = toSixDecimals(amount);
          if (amount <= 0) continue;
          out.push({ hash: sig, amount, network: 'sol', raw: t });
        }
      }
      if (out.length) logger.info('Helius SOL USDT txs', { count: out.length });
      return out;
    } catch (e) {
      logger.error('Helius SOL fetch error', e.message);
    }
  }

  // Fallback: public Solana RPC getSignatures + limited parse is heavy;
  // log once so ops set HELIUS_API_KEY
  if (!heliusKey) {
    logger.warn('HELIUS_API_KEY not set — Solana USDT deposits will not auto-detect');
  }
  return out;
}

function isValidEvmAddress(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr.trim());
}

function isValidTronAddress(addr) {
  return typeof addr === 'string' && /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(addr.trim());
}

function isValidSolAddress(addr) {
  if (typeof addr !== 'string') return false;
  const s = addr.trim();
  // Solana pubkeys: base58, typically 32–44 chars (32-byte key)
  if (s.length < 32 || s.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(s);
}

function validateWithdrawAddress(network, address) {
  const n = normalizeNetwork(network);
  if (n === 'erc20') {
    if (!isValidEvmAddress(address)) {
      throw new Error('Invalid ERC-20 address (must start with 0x and be 42 chars)');
    }
  } else if (n === 'trc20') {
    if (!isValidTronAddress(address)) {
      throw new Error('Invalid TRC-20 address (must start with T)');
    }
  } else if (n === 'sol') {
    if (!isValidSolAddress(address)) {
      throw new Error('Invalid Solana address (base58 pubkey)');
    }
  } else {
    throw new Error('Unsupported network');
  }
  return address.trim();
}

module.exports = {
  createPendingDeposit,
  getPendingForUser,
  listPending,
  scanAndCredit,
  markHashProcessed,
  isHashProcessed,
  getMasterAddress,
  normalizeNetwork,
  networkLabel,
  chainKeyForDb,
  validateWithdrawAddress,
  isValidEvmAddress,
  isValidTronAddress,
  isValidSolAddress,
  manualCreditDeposit,
  DEPOSIT_TTL_MS,
  processedHashes,
  USDT_SOL_MINT,
};
