const userService = require('../../services/userService');
const { mainMenu } = require('../../utils/ui');
const config = require('../../config');
const { formatUsd } = require('../../utils/helpers');
const copy = require('../../utils/copy');
const channelMembership = require('../../services/channelMembershipService');

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
      `👋 Welcome to *Insta Win*\n\n` +
        `Two instant games: *4/40* and *3/30*.\n\n` +
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
  const locked = Number(fresh.locked_tickets) || 0;
  const unlocked = Number(fresh.unlocked_tickets) || 0;
  const g440 = config.games['4_40'];
  const g330 = config.games['3_30'];

  const welcome = copy.welcome(fresh);

  await ctx.replyWithMarkdown(welcome, mainMenu());
  await channelMembership.maybePromptOnStart(ctx, { telegram: ctx.telegram }).catch(() => {});
  // public id tip
  if (fresh.public_id) {
    await ctx.replyWithMarkdown(
      `🪪 Your public player ID: *${fresh.public_id}*\n_Shown on live bets & contests (Telegram username hidden)._`
    ).catch(() => {});
  }
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
      await ctx.replyWithMarkdown(`Not quite. Try again: *${cap.a} + ${cap.b}*?`);
      return true;
    }
    onboarding.delete(ctx.from.id);
    await userService.setCaptchaPassed(ctx.from.id);
    const fresh = await userService.applyWelcomeIfEligible(ctx.from.id);
    await ctx.replyWithMarkdown(
      `✅ You're in!\n\nTap *Play* to choose *4/40* or *3/30*.\nEach game has its own rules & prizes.`,
      mainMenu()
    );
    if (fresh?.public_id) {
      await ctx.replyWithMarkdown(
        `🪪 Your public player ID: *${fresh.public_id}*\n_Used on live bets & contests (username hidden)._`
      ).catch(() => {});
    }
    await channelMembership.maybePromptOnStart(ctx, { telegram: ctx.telegram }).catch(() => {});
    return true;
  }

  return false;
};
