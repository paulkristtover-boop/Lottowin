const { Markup } = require('telegraf');

module.exports = {
  main: () =>
    Markup.keyboard([
      ['📈 Stats', '💸 Pending WD'],
      ['📢 Broadcast', '💬 Message User'],
      ['🎫 Support Tickets', '🛡️ Liability'],
      ['🎲 Set Draw', '📊 Tax Export'],
      ['🔒 Admin Panel'],
    ]).resize(),

  pendingActions: (withdrawalId) =>
    Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Approve', `adm:wd:ok:${withdrawalId}`),
        Markup.button.callback('❌ Reject', `adm:wd:no:${withdrawalId}`),
      ],
    ]),

  supportActions: (ticketId) =>
    Markup.inlineKeyboard([
      [Markup.button.callback('💬 Reply', `adm:sup:reply:${ticketId}`)],
      [Markup.button.callback('✔️ Close', `adm:sup:close:${ticketId}`)],
    ]),

  broadcastAudience: () =>
    Markup.inlineKeyboard([
      [Markup.button.callback('All users', 'adm:bc:all')],
      [Markup.button.callback('Active (7d)', 'adm:bc:active')],
      [Markup.button.callback('Depositors', 'adm:bc:depositors')],
      [Markup.button.callback('Cancel', 'adm:cancel')],
    ]),

  cancel: () =>
    Markup.inlineKeyboard([[Markup.button.callback('Cancel', 'adm:cancel')]]),
};
