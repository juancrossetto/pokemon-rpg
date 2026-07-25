import Image from "next/image";
import { PokeballIcon } from "@/components/pokeball-icon";

type LoaderVariant = "svg" | "gif";

/**
 * Loader de ruta. `gif` usa el asset transparente (fondo removido);
 * `svg` conserva la Pokéball animada en CSS (no se elimina).
 * Original con fondo: `/loaders/pokeball-loader.gif`.
 */
export function PokeballLoader({
  label,
  variant = "gif",
}: {
  label?: string;
  variant?: LoaderVariant;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-lg py-24">
      {variant === "gif" ? (
        <div className="relative flex items-center justify-center">
          <Image
            src="/loaders/pokeball-loader-transparent.gif?v=3"
            alt=""
            width={360}
            height={270}
            unoptimized
            priority
            className="relative h-auto w-[min(360px,70vw)] object-contain"
          />
        </div>
      ) : (
        <div className="relative">
          <div className="absolute -inset-8 scale-110 animate-pulse rounded-full bg-pokeball-red/10 blur-3xl" />

          <div className="relative h-[100px] w-[100px] drop-shadow-[0_0_15px_rgba(238,21,21,0.5)]">
            <PokeballIcon className="pokeball-spin-group h-full w-full" pulseButton />
          </div>

          <div className="absolute -inset-4 animate-[spin_10s_linear_infinite] rounded-full border-2 border-dashed border-pokeball-red/20" />
          <div className="absolute -inset-8 animate-[spin_15s_linear_infinite_reverse] rounded-full border border-surface-bright/20" />
        </div>
      )}

      {variant === "svg" && label ? (
        <p className="flex items-center gap-2 text-label-md uppercase tracking-[0.2em] text-pokeball-red">
          <span className="material-symbols-outlined animate-spin text-[20px]">autorenew</span>
          {label}
        </p>
      ) : null}
    </div>
  );
}
