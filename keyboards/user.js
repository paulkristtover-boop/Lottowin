const { Markup } = require('telegraf');

module.exports = {
  main: () =>
    Markup.keyboard([
      ['🎰 Play Lotto', '👛 Wallet'],
      ['📥 Deposit', '📤 Withdraw'],
      ['💰 Balance', '👥 Referral'],
      ['📊 Activity', '🛡️ Responsible'],
      ['ℹ️ How to Play', '🆘 Support'],
    ]).resize(),
  remove: () => Markup.removeKeyboard(),
};
