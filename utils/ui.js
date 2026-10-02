const { Markup } = require('telegraf');

/** Primary path: Play · Wallet · Support */
function mainMenu() {
  return Markup.keyboard([
    ['🎰 Play', '👛 Wallet', '🆘 Support'],
    ['📋 More'],
  ]).resize();
}

function moreMenu() {
  return Markup.keyboard([
    ['💰 Balance', '📥 Deposit', '📤 Withdraw'],
    ['👥 Referral', '📊 Activity'],
    ['🛡️ Responsible', 'ℹ️ How to Play'],
    ['« Main menu'],
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

function afterPlayMenu(gameId = '4_40') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎮 Play again', `game:${gameId}`),
      Markup.button.callback('👛 Wallet', 'ux:wallet'),
    ],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
}

function numberGrid(selected = [], game = { pick: 4, from: 1, to: 40 }) {
  const sel = new Set(selected);
  const pick = game.pick || 4;
  const max = game.to || 40;
  const rows = [];
  const cols = 5;
  for (let n = 1; n <= max; n += cols) {
    const row = [];
    for (let c = 0; c < cols; c++) {
      const num = n + c;
      if (num > max) break;
      const label = sel.has(num) ? `✅${num}` : `${num}`;
      row.push(Markup.button.callback(label, `num:${num}`));
    }
    rows.push(row);
  }
  rows.push([
    Markup.button.callback(`Clear (${selected.length}/${pick})`, 'num:clear'),
    Markup.button.callback('Done ✓', 'num:done'),
  ]);
  return Markup.inlineKeyboard(rows);
}

function gamePicker() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎯 Insta Win 4/40', 'game:4_40')],
    [Markup.button.callback('🎲 Insta Win 3/30', 'game:3_30')],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
}

function depositMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('USDT TRC-20 (Tron)', 'dep:trc20')],
    [Markup.button.callback('USDT ERC-20 (Ethereum)', 'dep:erc20')],
    [Markup.button.callback('📋 My pending deposit', 'dep:status')],
    [Markup.button.callback('👛 Wallet', 'ux:wallet')],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
}

function withdrawMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('USDT TRC-20 (Tron)', 'wd:trc20')],
    [Markup.button.callback('USDT ERC-20 (Ethereum)', 'wd:erc20')],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
}

function responsibleMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('Set Daily Limit', 'resp:daily')],
    [Markup.button.callback('Set Session Limit', 'resp:session')],
    [Markup.button.callback('Take Time-Out (24h)', 'resp:timeout24')],
    [Markup.button.callback('Self-Exclude (7 days)', 'resp:exclude7')],
    [Markup.button.callback('« Main menu', 'menu:main')],
  ]);
}

module.exports = {
  mainMenu,
  moreMenu,
  playMenu,
  afterPlayMenu,
  numberGrid,
  gamePicker,
  depositMenu,
  withdrawMenu,
  responsibleMenu,
};
