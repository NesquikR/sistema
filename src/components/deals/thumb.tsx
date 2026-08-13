import { cn } from "@/lib/utils";
import type { Deal } from "@/types";

/**
 * Miniatura do produto. Não dependemos de imagens externas: renderizamos um
 * "pack shot" sintético a partir do gradiente + iniciais da marca, o que mantém
 * a grade visualmente consistente e sem estados de imagem quebrada.
 */
export function DealThumb({
  deal,
  size = 56,
  className,
}: {
  deal: Deal;
  size?: number;
  className?: string;
}) {
  const initials = deal.brand
    .split(/[\s-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-[12px] border border-line-strong",
        className,
      )}
      style={{ width: size, height: size, background: deal.image }}
      aria-hidden
    >
      <span className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_0%,#ffffff14,transparent)]" />
      <span
        className="absolute inset-0 flex items-center justify-center font-semibold tracking-[-0.02em] text-white/70"
        style={{ fontSize: size * 0.3 }}
      >
        {initials}
      </span>
      {deal.discount >= 45 && (
        <span className="absolute bottom-0 left-0 right-0 bg-black/55 py-[2px] text-center text-[9px] font-bold tracking-wide text-white backdrop-blur-sm">
          -{deal.discount}%
        </span>
      )}
    </div>
  );
}
