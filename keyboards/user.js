const { Markup } = require('telegraf');

module.exports = {
  main: () =>
    Markup.keyboard([
      ['🎰 Play', '👛 Wallet', '🆘 Support'],
      ['📋 More'],
    ]).resize(),
  more: () =>
    Markup.keyboard([
      ['💰 Balance', '📥 Deposit', '📤 Withdraw'],
      ['👥 Referral', '📊 Activity'],
      ['🛡️ Responsible', 'ℹ️ How to Play'],
      ['« Main menu'],
    ]).resize(),
  remove: () => Markup.removeKeyboard(),
};
