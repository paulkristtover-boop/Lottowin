const { Markup } = require('telegraf');

module.exports = {
  main: () =>
    Markup.keyboard([
      ['🎰 Play Lotto', '💰 Balance'],
      ['📥 Deposit', '📤 Withdraw'],
      ['📊 Activity', '👥 Referral'],
      ['🛡️ Responsible Play', 'ℹ️ How to Play'],
      ['🆘 Support'],
    ]).resize(),

  remove: () => Markup.removeKeyboard(),
};
