const { query } = require('../../database');
const { mainMenu } = require('../../utils/ui');
const config = require('../../config');

const pendingSupport = new Map();

async function showSupport(ctx) {
  const text = `🆘 *Support*

For help, message @${config.supportUsername}
or type your question below and we will create a ticket.

Or /cancel`;

  pendingSupport.set(ctx.from.id, true);
  await ctx.replyWithMarkdown(text, mainMenu());
}

async function handleSupportText(ctx) {
  if (!pendingSupport.get(ctx.from.id)) return false;
  pendingSupport.delete(ctx.from.id);

  const msg = ctx.message.text.trim();
  if (msg.length < 5) {
    await ctx.reply('Please write a longer message.');
    return true;
  }

  await query(
    `INSERT INTO support_tickets (user_id, message) VALUES ($1, $2)`,
    [ctx.from.id, msg]
  );

  await ctx.replyWithMarkdown(
    `✅ Ticket created. Our team will reply soon.\nYou can also contact @${config.supportUsername}`,
    mainMenu()
  );
  return true;
}

module.exports = {
  showSupport,
  handleSupportText,
  pendingSupport,
};
