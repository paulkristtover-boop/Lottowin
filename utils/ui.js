const { Markup } = require('telegraf');

function mainMenu() {
  return Markup.keyboard([
    ['🎰 Play Lotto', '💰 Balance'],
    ['📥 Deposit', '📤 Withdraw'],
    ['📊 Activity', '👥 Referral'],
    ['🛡️ Responsible', 'ℹ️ About'],
    ['🆘 Support'],
  ]).resize();
}

function playMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('➕ Add Line', 'play:add'), Markup.button.callback('🎲 Quick Pick', 'play:qp')],
    [Markup.button.callback('+3 Lines', 'play:plus3'), Markup.button.callback('+5 Lines', 'play:plus5')],
    [Markup.button.callback('✅ Confirm & Play', 'play:confirm')],
    [Markup.button.callback('❌ Cancel', 'play:cancel')],
  ]);
}

function numberGrid(selected = []) {
  const sel = new Set(selected);
  const rows = [];
  for (let r = 0; r < 8; r++) {
    const row = [];
    for (let c = 0; c < 5; c++) {
      const n = r * 5 + c + 1;
      if (n > 40) break;
      const label = sel.has(n) ? `✅${n}` : `${n}`;
      row.push(Markup.button.callback(label, `num:${n}`));
    }
    rows.push(row);
  }
  rows.push([
    Markup.button.callback(`Clear (${selected.length}/4)`, 'num:clear'),
    Markup.button.callback('Done ✓', 'num:done'),
  ]);
  return Markup.inlineKeyboard(rows);
}

function depositMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('USDT (TRC20)', 'dep:usdt_trc20')],
    [Markup.button.callback('USDT (ERC20)', 'dep:usdt_erc20')],
    [Markup.button.callback('Claim by TX Hash', 'dep:claim')],
    [Markup.button.callback('« Back', 'menu:main')],
  ]);
}

function withdrawMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('USDT TRC20', 'wd:usdt_trc20')],
    [Markup.button.callback('USDT ERC20', 'wd:usdt_erc20')],
    [Markup.button.callback('« Back', 'menu:main')],
  ]);
}

function responsibleMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Set Daily Limit', 'resp:daily')],
    [Markup.button.callback('Set Session Limit', 'resp:session')],
    [Markup.button.callback('Take Time-Out (24h)', 'resp:timeout24')],
    [Markup.button.callback('Self-Exclude (7 days)', 'resp:exclude7')],
    [Markup.button.callback('« Back', 'menu:main')],
  ]);
}

module.exports = {
  mainMenu,
  playMenu,
  numberGrid,
  depositMenu,
  withdrawMenu,
  responsibleMenu,
};
