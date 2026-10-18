const { Markup } = require('telegraf');

function mainMenu() {
  return Markup.keyboard([
    ['🎰 Buy lines', '💰 Pot & draw'],
    ['👛 Wallet', '📥 Deposit'],
    ['📋 More'],
  ]).resize();
}

function moreMenu() {
  return Markup.keyboard([
    ['💰 Balance', '📤 Withdraw'],
    ['🎫 My lines', '📊 Results'],
    ['ℹ️ How to play', '🆘 Support'],
    ['« Main menu'],
  ]).resize();
}

function playActions() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎲 Quick Pick 1 line', 'jp:qp:1')],
    [Markup.button.callback('🎲 Quick Pick 3 lines', 'jp:qp:3')],
    [Markup.button.callback('✍️ Enter numbers', 'jp:manual')],
    [Markup.button.callback('💰 Pot status', 'jp:status')],
  ]);
}

function depositMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⚡ TRX (Tron)', 'dep:trx')],
    [Markup.button.callback('💎 ETH (Ethereum)', 'dep:eth')],
    [Markup.button.callback('🔄 Pending status', 'dep:status')],
    [Markup.button.callback('« Main', 'menu:main')],
  ]);
}

function withdrawMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('⚡ TRX (Tron)', 'wd:trx')],
    [Markup.button.callback('💎 ETH (Ethereum)', 'wd:eth')],
    [Markup.button.callback('« Main', 'menu:main')],
  ]);
}

module.exports = { mainMenu, moreMenu, playActions, depositMenu, withdrawMenu };
