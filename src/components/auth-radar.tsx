import { PokeballIcon } from "@/components/pokeball-icon";

export function AuthRadar({
  brandPrefix,
  brandAccent,
  status,
}: {
  brandPrefix: string;
  brandAccent: string;
  status: string;
}) {
  return (
    <div className="flex flex-col items-center gap-4 pt-2 pb-2">
      <h1 className="flex items-center gap-3 text-headline-lg md:text-display-lg font-black tracking-tight text-center">
        <span className="material-symbols-outlined text-electric-yellow text-[28px]! md:text-[36px]">
          workspaces
        </span>
        <span className="text-on-surface">{brandPrefix}</span>
        <span className="text-pokeball-red drop-shadow-[0_0_12px_rgba(238,21,21,0.5)]">
          {brandAccent}
        </span>
      </h1>

      <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-surface-container-low px-3 py-1 text-label-sm text-on-surface-variant font-mono">
        <span className="material-symbols-outlined text-[16px]! animate-spin text-electric-yellow">
          settings
        </span>
        {status}
        <span className="blinking-cursor text-pokeball-red">_</span>
      </span>

      <div className="relative w-[150px] h-[150px] my-3">
        {/* Halo */}
        <div className="absolute -inset-10 bg-pokeball-red/12 rounded-full blur-3xl" />

        {/* Anillos concéntricos: rojo punteado, azul, dorado parcial */}
        <div className="absolute -inset-3 border-2 border-dashed border-pokeball-red/40 rounded-full animate-[spin_9s_linear_infinite]" />
        <div className="absolute -inset-7 border-2 border-secondary/25 border-t-secondary/70 rounded-full animate-[spin_14s_linear_infinite_reverse]" />
        <div className="absolute -inset-11 border border-tertiary/40 border-b-transparent border-l-transparent rounded-full animate-[spin_20s_linear_infinite]" />
        <div className="absolute inset-3 border border-white/10 rounded-full" />

        {/* Línea de mira horizontal */}
        <div className="absolute top-1/2 -left-8 -right-8 h-px bg-pokeball-red/60 -translate-y-1/2">
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-3 h-1 bg-white/50 rounded-full" />
          <span className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-1 bg-white/50 rounded-full" />
        </div>

        <div className="relative w-full h-full drop-shadow-[0_0_18px_rgba(238,21,21,0.55)]">
          <PokeballIcon className="w-full h-full pokeball-spin-group" pulseButton />
        </div>
      </div>
    </div>
  );
}
