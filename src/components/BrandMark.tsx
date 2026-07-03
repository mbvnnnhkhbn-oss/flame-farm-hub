import { Flame } from "lucide-react";

export function BrandMark({ size = 40, showWord = true }: { size?: number; showWord?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="relative flex items-center justify-center rounded-2xl bg-gradient-flame shadow-flame"
        style={{ width: size, height: size }}
      >
        <Flame className="text-primary-foreground" style={{ width: size * 0.55, height: size * 0.55 }} />
      </span>
      {showWord && (
        <span className="text-xl font-black tracking-tight">
          <span className="text-foreground">Coin</span>
          <span className="text-gradient-flame">Flames</span>
        </span>
      )}
    </div>
  );
}
