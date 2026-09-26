const { Markup } = require('telegraf');

module.exports = {
  main: () =>
    Markup.keyboard([
      ['🎰 Play Lotto', '💰 Balance'],
      ['📥 Deposit', '📤 Withdraw'],
      ['📊 Activity', '👥 Referral'],
      ['🛡️ Responsible Play', 'ℹ️ About'],
      ['🆘 Support'],
    ]).resize(),

  remove: () => Markup.removeKeyboard(),
};
