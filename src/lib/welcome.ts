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
