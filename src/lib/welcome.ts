// Shared welcome message + inline keyboard for /start and new-user DMs.
export const WELCOME_PHOTO_URL = "https://i.ibb.co/mVcB66gf/coinflames.jpg";

export function welcomeCaption(firstName?: string): string {
  const hi = firstName ? `Hey ${firstName}! ` : "";
  return (
    `🔥 <b>Welcome to CoinFlames</b>\n\n` +
    `${hi}Earn <b>Flames 🔥</b> every day and cash out as USDT (BEP20).\n\n` +
    `<b>Ways to earn:</b>\n` +
    `• 👀 AdsGram Reward ads — <b>5 Flames</b> each (10/day)\n` +
    `• 🎬 AdsGram Int ads — <b>5 Flames</b> each (10/day)\n` +
    `• ⛏ Mining machines — up to <b>50 Flames/hr</b>, claim hourly\n` +
    `• 🎯 Complete tasks & join channels\n` +
    `• 🎁 Daily check-in bonuses + app-open bonus\n` +
    `• 🤝 Invite friends — <b>25 + 50 + 75 Flames</b> milestones and <b>5% lifetime commission</b>\n` +
    `• 🎫 Redeem reward codes\n\n` +
    `💵 <b>100 Flames = $0.01 USDT</b>\n` +
    `💸 Minimum withdraw only <b>$0.1 USDT</b> to your BEP20 wallet.\n` +
    `🧾 All payouts are posted publicly in our Payments channel.\n\n` +
    `Tap <b>Open Mini App</b> to start earning right now.`
  );
}

export function welcomeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "🚀 Open Mini App", url: "https://t.me/Coinflamesbot/coinflames" }],
      [
        { text: "💬 Community", url: "https://t.me/CoinFlames" },
        { text: "💸 Payments", url: "https://t.me/coinflamespayment" },
      ],
    ],
  };
}

export const MINI_APP_URL = "https://t.me/Coinflamesbot/coinflames";
export const COMMUNITY_URL = "https://t.me/CoinFlames";
export const PAYMENTS_URL = "https://t.me/coinflamespayment";

/** Standard inline keyboard for system notifications. */
export function appKeyboard(extra?: { text: string; url: string }) {
  const rows: { text: string; url: string }[][] = [];
  if (extra) rows.push([extra]);
  rows.push([{ text: "🚀 Open Mini App", url: MINI_APP_URL }]);
  rows.push([
    { text: "💬 Community", url: COMMUNITY_URL },
    { text: "💸 Payments", url: PAYMENTS_URL },
  ]);
  return { inline_keyboard: rows };
}

/** Rotating reminder messages sent a few times a day. */
export const REMINDER_MESSAGES: { title: string; body: string }[] = [
  {
    title: "⛏ Your mining machine is idle!",
    body:
      "Flames don't mine themselves 😄\n\n" +
      "• Claim your hourly mining reward\n" +
      "• Up to <b>10 claims per machine</b> each day\n\n" +
      "Tap below and grab your Flames 🔥",
  },
  {
    title: "👀 Daily ads are waiting",
    body:
      "You still have ads left today!\n\n" +
      "• 🎥 AdsGram Reward — <b>5 Flames</b> each\n" +
      "• 🎬 AdsGram Int — <b>5 Flames</b> each\n" +
      "• 🌐 View Site — <b>3 Flames</b> each\n\n" +
      "A few minutes = more USDT 💵",
  },
  {
    title: "🎁 Don't lose your check-in streak",
    body:
      "Daily check-in resets at <b>00:00 UTC</b>.\n\n" +
      "Longer streak = bigger bonus 🔥\nOpen the app and claim it now.",
  },
  {
    title: "🤝 Invite friends, earn forever",
    body:
      "Every friend pays you:\n\n" +
      "• <b>25 Flames</b> on join\n" +
      "• <b>50 Flames</b> Day 1\n" +
      "• <b>75 Flames</b> Day 2\n" +
      "• <b>5% lifetime commission</b> 💰\n\n" +
      "Share your invite link today!",
  },
  {
    title: "💸 Cash out from just $0.1",
    body:
      "Minimum withdraw is only <b>$0.1 USDT</b> (BEP20).\n\n" +
      "🧾 Every payout is posted publicly in our Payments channel — proof for everyone.",
  },
];
