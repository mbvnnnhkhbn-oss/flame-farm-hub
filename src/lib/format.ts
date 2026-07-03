export function formatFlames(n: number | bigint | null | undefined): string {
  const num = Number(n ?? 0);
  return new Intl.NumberFormat("en-US").format(num);
}

export function flamesToUsdt(flames: number, ratePerUsdt: number): number {
  if (!ratePerUsdt) return 0;
  return flames / ratePerUsdt;
}

export function usdtToFlames(usdt: number, ratePerUsdt: number): number {
  return Math.round(usdt * ratePerUsdt);
}

export function formatUsdt(usdt: number): string {
  return `$${usdt.toFixed(4)}`;
}

export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return "";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
