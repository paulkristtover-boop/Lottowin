const { query } = require('../database');
const config = require('../config');
const userService = require('./userService');
const axios = require('axios');

async function getRates() {
  // Simple static fallback + optional live rates
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

async function createWithdrawal(telegramId, chain, address, amountUsd) {
  const user = await userService.getUser(telegramId);
  if (!user) throw new Error('User not found');
  if (user.is_banned) throw new Error('Account banned');
  if (config.adminIds.includes(Number(telegramId))) {
    throw new Error('Admin accounts cannot withdraw');
  }
  if (amountUsd < config.minWithdrawUsd) {
    throw new Error(`Minimum withdrawal is $${config.minWithdrawUsd}`);
  }

  const feePct = Number(config.withdrawalFeePercent) || 0;
  const feeUsd = Math.round(amountUsd * (feePct / 100) * 1e6) / 1e6;
  const totalDebit = Math.round((amountUsd + feeUsd) * 1e6) / 1e6;

  if (Number(user.balance_usd) < totalDebit) {
    throw new Error(
      `Insufficient balance. Need $${totalDebit} (amount $${amountUsd} + ${feePct}% fee $${feeUsd})`
    );
  }

  // Debit amount + fee (fee is house revenue)
  await userService.debitBalance(telegramId, totalDebit, 'withdraw', null, {
    chain,
    address,
    status: 'pending',
    amount_usd: amountUsd,
    fee_usd: feeUsd,
    fee_percent: feePct,
  });

  const rates = await getRates();
  let amountCrypto = 0;
  if (chain === 'usdt_trc20' || chain === 'usdt_erc20') amountCrypto = amountUsd / rates.usdt;
  else if (chain === 'btc') amountCrypto = amountUsd / rates.btc;
  else if (chain === 'eth') amountCrypto = amountUsd / rates.eth;
  else if (chain === 'trx') amountCrypto = amountUsd / rates.trx;

  const res = await query(
    `INSERT INTO withdrawals (user_id, chain, address, amount_usd, amount_crypto, rate_usd, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'pending') RETURNING *`,
    [telegramId, chain, address, amountUsd, amountCrypto, rates.usdt || 1]
  );

  return res.rows[0];
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
  return res.rows[0];
}

async function rejectWithdrawal(id, adminId, reason) {
  const w = await query(`SELECT * FROM withdrawals WHERE id = $1 AND status = 'pending'`, [id]);
  if (!w.rows[0]) return null;
  const row = w.rows[0];
  // Refund
  await userService.creditBalance(row.user_id, Number(row.amount_usd), 'adjustment', id, {
    reason: 'withdrawal_rejected',
    note: reason,
  });
  await query(
    `UPDATE withdrawals SET status = 'rejected', admin_note = $2, processed_at = NOW() WHERE id = $1`,
    [id, reason]
  );
  await query(
    `INSERT INTO audit_logs (actor_id, actor_type, action, target_type, target_id, details)
     VALUES ($1, 'admin', 'reject_withdrawal', 'withdrawal', $2, $3)`,
    [adminId, id, { reason }]
  );
  return row;
}

module.exports = {
  getRates,
  createWithdrawal,
  getPendingWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
};
