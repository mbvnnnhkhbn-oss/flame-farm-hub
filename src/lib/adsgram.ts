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

// AdsGram requires BlockIds prefixed with "int-". Users often paste just the
// numeric portion (e.g. "37178") — normalize both here so either works.
export function normalizeBlockId(raw?: string | null): string | null {
  if (!raw) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("int-")) return trimmed;
  return `int-${trimmed}`;
}

export function getAdController(blockId: string): AdController | null {
  if (typeof window === "undefined" || !window.Adsgram || !blockId) return null;
  const id = normalizeBlockId(blockId) ?? blockId;
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
  const blocks = [normalizeBlockId(rewardBlockId), normalizeBlockId(interstitialBlockId)].filter(
    (b): b is string => typeof b === "string" && b.length > 0,
  );
  if (blocks.length === 0) return null;
  return blocks[Math.floor(Math.random() * blocks.length)];
}

// Fire-and-forget interstitial. Never throws — safe to call anywhere.
export async function showInterstitialSilently(blockId?: string | null): Promise<void> {
  const id = normalizeBlockId(blockId);
  if (!id) return;
  try {
    const ctrl = getAdController(id);
    if (!ctrl) return;
    await ctrl.show();
  } catch {
    // ignore — this is a background impression
  }
}
