const { query } = require('../database');
const config = require('../config');
const userService = require('./userService');
const axios = require('axios');

function toSixDecimals(n) {
  return Math.round(Number(n) * 1e6) / 1e6;
}

async function getRates() {
  try {
    const { data } = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
      params: {
        ids: 'tether,bitcoin,ethereum,tron',
        vs_currencies: 'usd',
      },
      timeout: 5000,
    });
    return {
      usdt: data.tether?.usd || 1,
      btc: data.bitcoin?.usd || 60000,
      eth: data.ethereum?.usd || 3000,
      trx: data.tron?.usd || 0.12,
    };
  } catch {
    return { usdt: 1, btc: 60000, eth: 3000, trx: 0.12 };
  }
}

/**
 * Fixed fee by network ≈ 2× typical USDT transfer cost.
 * TRC-20 default $1 · ERC-20 default $2 (env override).
 */
function getWithdrawFeeUsd(chain) {
  const c = String(chain || '').toLowerCase();
  if (c.includes('erc20') || c === 'eth') {
    return toSixDecimals(config.withdrawFeeErc20Usd || 2);
  }
  // trc20 / tron default
  return toSixDecimals(config.withdrawFeeTrc20Usd || 1);
}

/**
 * Unique exact payout amount (same idea as deposits).
 * Base + micro dust so outbound TXs can be matched later.
 */
async function generateUniqueWithdrawAmount(baseAmount) {
  const base = toSixDecimals(baseAmount);
  for (let attempt = 0; attempt < 100; attempt++) {
    const modifier = Math.floor(Math.random() * 9999 + 1) / 1e6;
    const exact = toSixDecimals(base + modifier);
    const res = await query(
      `SELECT id FROM withdrawals
       WHERE status = 'pending'
         AND ABS(amount_usd - $1::numeric) < 0.0000005
       LIMIT 1`,
      [exact]
    );
    if (!res.rows[0]) return exact;
  }
  throw new Error('Could not allocate a unique payout amount. Try again.');
}

/**
 * Create withdrawal.
 * - amountRequested = what user typed (desired net)
 * - amount_usd stored = exact unique payout admin must SEND
 * - fee_usd = fixed network fee (debited with hold)
 * - total debit = exact + fee
 */
async function createWithdrawal(telegramId, chain, address, amountRequested) {
  const user = await userService.getUser(telegramId);
  if (!user) throw new Error('User not found');
  if (user.is_banned) throw new Error('Account banned');
  if (config.adminIds.includes(Number(telegramId))) {
    throw new Error('Admin accounts cannot withdraw');
  }

  const requested = toSixDecimals(amountRequested);
  if (requested < config.minWithdrawUsd) {
    throw new Error(`Minimum withdrawal is $${config.minWithdrawUsd}`);
  }

  const feeUsd = getWithdrawFeeUsd(chain);
  const exactAmount = await generateUniqueWithdrawAmount(requested);
  const totalDebit = toSixDecimals(exactAmount + feeUsd);

  if (Number(user.balance_usd) < totalDebit) {
    throw new Error(
      `Insufficient balance. Need $${totalDebit.toFixed(6)} ` +
        `(payout $${exactAmount.toFixed(6)} + fee $${feeUsd.toFixed(6)})`
    );
  }

  await userService.debitBalance(telegramId, totalDebit, 'withdraw', null, {
    chain,
    address,
    status: 'pending',
    amount_usd: exactAmount,
    fee_usd: feeUsd,
    requested_usd: requested,
  });

  const rates = await getRates();
  let amountCrypto = exactAmount;
  if (chain === 'btc') amountCrypto = exactAmount / rates.btc;
  else if (chain === 'eth') amountCrypto = exactAmount / rates.eth;
  else if (chain === 'trx') amountCrypto = exactAmount / rates.trx;
  // USDT chains: 1:1 with USD

  const res = await query(
    `INSERT INTO withdrawals (user_id, chain, address, amount_usd, amount_crypto, rate_usd, fee_usd, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending') RETURNING *`,
    [telegramId, chain, address, exactAmount, amountCrypto, rates.usdt || 1, feeUsd]
  );

  const row = res.rows[0];
  return {
    ...row,
    amount_usd: Number(row.amount_usd),
    fee_usd: Number(row.fee_usd),
    exact_amount: exactAmount,
    requested_usd: requested,
    total_debit: totalDebit,
  };
}

async function getPendingWithdrawals() {
  const res = await query(
    `SELECT w.*, u.username, u.first_name FROM withdrawals w
     JOIN users u ON u.telegram_id = w.user_id
     WHERE w.status = 'pending' ORDER BY w.requested_at ASC`
  );
  return res.rows;
}

async function approveWithdrawal(id, adminId, txHash = null) {
  const res = await query(
    `UPDATE withdrawals SET status = 'completed', tx_hash = $2, processed_at = NOW()
     WHERE id = $1 AND status = 'pending' RETURNING *`,
    [id, txHash]
  );
  if (res.rows[0]) {
    await query(
      `INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
       VALUES ($1, 'admin', 'approve_withdrawal', 'withdrawal', $2, $3)`,
      [adminId, id, { txHash }]
    );
  }
  return res.rows[0] || null;
}

/**
 * Reject: refund amount_usd + fee_usd (full hold).
 */
async function rejectWithdrawal(id, adminId, reason) {
  const w = await query(`SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending'`, [id]);
  if (!w.rows[0]) return null;
  const row = w.rows[0];

  const payout = Number(row.amount_usd) || 0;
  const fee = Number(row.fee_usd) || 0;
  const refund = toSixDecimals(payout + fee);

  if (refund > 0) {
    await userService.creditBalance(row.user_id, refund, 'adjustment', id, {
      reason: 'withdrawal_rejected',
      note: reason,
      refund_payout: payout,
      refund_fee: fee,
    });
  }

  await query(
    `UPDATE withdrawals SET status = 'rejected', admin_note = $2, processed_at = NOW() WHERE id = $1`,
    [id, reason]
  );
  await query(
    `INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
     VALUES ($1, 'admin', 'reject_withdrawal', 'withdrawal', $2, $3)`,
    [adminId, id, { reason, refund }]
  );
  return row;
}

module.exports = {
  getRates,
  getWithdrawFeeUsd,
  createWithdrawal,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  toSixDecimals,
};
