// Shared welcome message + inline keyboard for /start and new-user DMs.
export const WELCOME_PHOTO_URL = "https://i.ibb.co/mVcB66gf/coinflames.jpg";

export function welcomeCaption(firstName?: string): string {
  const hi = firstName ? `Hey ${firstName}! ` : "";
  return (
    `🔥 <b>Welcome to CoinFlames</b>\n\n` +
    `${hi}Earn <b>Flames 🔥</b> every day and cash out as USDT (BEP20).\n\n` +
    `<b>Ways to earn:</b>\n` +
    `• 👀 Watch short ads (10 Flames each)\n` +
    `• ⛏ Mining machines (up to 100 Flames/hr)\n` +
    `• 🎯 Complete tasks & join channels\n` +
    `• 🎁 Daily check-in bonuses\n` +
    `• 🤝 Invite friends — <b>150 Flames</b> per active referral\n` +
    `• 🎫 Redeem reward codes\n\n` +
    `💵 <b>100 Flames = $0.01 USDT</b>\n` +
    `💸 Withdraw as low as <b>$1 USDT</b> to your BEP20 wallet.\n\n` +
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
