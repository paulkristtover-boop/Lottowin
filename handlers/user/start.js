const userService = require('../../services/userService');
const { mainMenu } = require('../../utils/ui');
const config = require('../../config');
const { formatUsd } = require('../../utils/helpers');

const onboarding = new Map();

function makeCaptcha() {
  const a = Math.floor(Math.random() * 9) + 2;
  const b = Math.floor(Math.random() * 9) + 2;
  return { a, b, answer: a + b };
}

module.exports = async (ctx) => {
  const payload = ctx.startPayload || '';
  const user = await userService.findOrCreateUser(ctx.from, payload || null);

  if (!user.age_verified_at) {
    onboarding.set(ctx.from.id, { step: 'yob' });
    return ctx.replyWithMarkdown(
      `👋 Welcome to *Insta Win 4/40*\n\n` +
        `⚠️ *18+ only.* Gambling involves risk.\n\n` +
        `Please enter your *year of birth* (e.g. \`1995\`) to continue.`
    );
  }

  if (!user.captcha_passed_at) {
    const cap = makeCaptcha();
    onboarding.set(ctx.from.id, { step: 'captcha', ...cap });
    return ctx.replyWithMarkdown(
      `🔒 *Quick check*\n\nWhat is *${cap.a} + ${cap.b}*? Reply with the number.`
    );
  }

  const fresh = await userService.applyWelcomeIfEligible(ctx.from.id);

  const welcome =
    `🎰 *Welcome to Insta Win 4/40!*\n\n` +
    `Instant lottery — pick 4 from 1–40, win immediately.\n\n` +
    `💰 Balance: *${formatUsd(fresh.balance_usd)}*\n` +
    `\n*Play cost:* ${formatUsd(config.playCostUsd)} per line (up to ${config.maxLines})\n\n` +
    `⚠️ Deposit $1+ to unlock free welcome tickets. Play responsibly. Set limits. Take time-outs. 18+.`;

  await ctx.replyWithMarkdown(welcome, mainMenu());
};

module.exports.handleOnboardingText = async (ctx) => {
  const state = onboarding.get(ctx.from.id);
  if (!state) return false;

  const text = (ctx.message.text || '').trim();

  if (state.step === 'yob') {
    const year = parseInt(text, 10);
    if (isNaN(year)) {
      await ctx.reply('Please enter a 4-digit year, e.g. 1995');
      return true;
    }
    try {
      await userService.setYearOfBirth(ctx.from.id, year);
      const cap = makeCaptcha();
      onboarding.set(ctx.from.id, { step: 'captcha', ...cap });
      await ctx.replyWithMarkdown(
        `✅ Age verified.\n\n🔒 *Quick check*\nWhat is *${cap.a} + ${cap.b}*?`
      );
    } catch (e) {
      await ctx.reply(`❌ ${e.message}`);
    }
    return true;
  }

  if (state.step === 'captcha') {
    const ans = parseInt(text, 10);
    if (ans !== state.answer) {
      const cap = makeCaptcha();
      onboarding.set(ctx.from.id, { step: 'captcha', ...cap });
      await ctx.replyWithMarkdown(`Wrong answer. Try again: what is *${cap.a} + ${cap.b}*?`);
      return true;
    }
    await userService.setCaptchaPassed(ctx.from.id);
    onboarding.delete(ctx.from.id);
    const fresh = await userService.applyWelcomeIfEligible(ctx.from.id);
    await ctx.replyWithMarkdown(
      `✅ Verified!\n\n💰 Balance: *${formatUsd(fresh.balance_usd)}*\n\nYou can play now.`,
      mainMenu()
    );
    return true;
  }

  return false;
};

module.exports.onboarding = onboarding;
