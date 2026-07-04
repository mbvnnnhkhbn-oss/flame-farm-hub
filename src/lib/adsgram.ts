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

export function getAdController(blockId: string): AdController | null {
  if (typeof window === "undefined" || !window.Adsgram || !blockId) return null;
  let ctrl = controllers.get(blockId);
  if (!ctrl) {
    ctrl = window.Adsgram.init({ blockId });
    controllers.set(blockId, ctrl);
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

// Pick a random block id from the available reward + interstitial blocks.
export function pickRandomBlockId(
  rewardBlockId?: string | null,
  interstitialBlockId?: string | null,
): string | null {
  const blocks = [rewardBlockId, interstitialBlockId].filter(
    (b): b is string => typeof b === "string" && b.length > 0,
  );
  if (blocks.length === 0) return null;
  return blocks[Math.floor(Math.random() * blocks.length)];
}
