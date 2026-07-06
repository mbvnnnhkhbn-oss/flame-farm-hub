// AdsGram SDK wrapper (client-only).
// Docs: https://docs.adsgram.ai/
declare global {
  interface Window {
    Adsgram?: {
      init: (opts: { blockId: string; debug?: boolean }) => AdController;
    };
  }
}

export type AdController = {
  show: () => Promise<ShowPromiseResult>;
  destroy?: () => void;
};

export type ShowPromiseResult = {
  done: boolean;
  description: string;
  state: "load" | "render" | "playing" | "destroy";
  error: boolean;
};

const controllers = new Map<string, AdController>();

export function cleanBlockId(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  return trimmed.length > 0 ? trimmed : null;
}

// Reward blocks must be passed as the plain numeric BlockID. The screenshot's
// AdsgramError happened because the reward block was force-prefixed with int-.
export function normalizeRewardBlockId(raw?: string | null): string | null {
  const id = cleanBlockId(raw);
  if (!id) return null;
  return id.startsWith("int-") ? id.slice(4) : id;
}

// Interstitial blocks use the int- prefix in this app's AdsGram setup.
export function normalizeInterstitialBlockId(raw?: string | null): string | null {
  const id = cleanBlockId(raw);
  if (!id) return null;
  return id.startsWith("int-") ? id : `int-${id}`;
}

export function getAdController(blockId: string): AdController | null {
  if (typeof window === "undefined" || !window.Adsgram || !blockId) return null;
  const id = cleanBlockId(blockId) ?? blockId;
  let ctrl = controllers.get(id);
  if (!ctrl) {
    ctrl = window.Adsgram.init({ blockId: id });
    controllers.set(id, ctrl);
  }
  return ctrl;
}

export async function showAd(blockId: string): Promise<ShowPromiseResult> {
  const ctrl = getAdController(blockId);
  if (!ctrl) {
    throw new Error("AdsGram not available. Set an AdsGram Block ID in Admin → Settings.");
  }
  return ctrl.show();
}

export function pickRandomBlockId(
  rewardBlockId?: string | null,
  interstitialBlockId?: string | null,
): string | null {
  const blocks = [
    normalizeRewardBlockId(rewardBlockId),
    normalizeInterstitialBlockId(interstitialBlockId),
  ].filter((b): b is string => typeof b === "string" && b.length > 0);
  if (blocks.length === 0) return null;
  return blocks[Math.floor(Math.random() * blocks.length)];
}

// Fire-and-forget interstitial. Never throws — safe to call anywhere.
export async function showInterstitialSilently(blockId?: string | null): Promise<void> {
  const id = normalizeInterstitialBlockId(blockId);
  if (!id) return;
  try {
    const ctrl = getAdController(id);
    if (!ctrl) return;
    await ctrl.show();
  } catch {
    // ignore — this is a background impression
  }
}
