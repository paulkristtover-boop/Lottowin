const { Markup } = require('telegraf');

/** Keep in sync with utils/ui.js mainMenu / moreMenu */
module.exports = {
  main: () =>
    Markup.keyboard([
      ['🎰 Play', '👛 Wallet', '🆘 Support'],
      ['📋 More'],
    ]).resize(),

  more: () =>
    Markup.keyboard([
      ['💰 Balance', '📥 Deposit', '📤 Withdraw'],
      ['🎯 Wager', '📡 Live bets'],
      ['🏁 Contest', '⚔️ Battle'],
      ['👥 Referral', '📊 Activity'],
      ['🛡️ Responsible', 'ℹ️ How to Play'],
      ['« Main menu'],
    ]).resize(),

  remove: () => Markup.removeKeyboard(),
};
