import { PokeballIcon } from "@/components/pokeball-icon";

export function PokeballLoader({ label }: { label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-lg py-24">
      <div className="relative">
        <div className="absolute -inset-8 bg-pokeball-red/10 rounded-full blur-3xl scale-110 animate-pulse" />

        <div className="relative w-[100px] h-[100px] drop-shadow-[0_0_15px_rgba(238,21,21,0.5)]">
          <PokeballIcon className="w-full h-full pokeball-spin-group" pulseButton />
        </div>

        <div className="absolute -inset-4 border-2 border-dashed border-pokeball-red/20 rounded-full animate-[spin_10s_linear_infinite]" />
        <div className="absolute -inset-8 border border-surface-bright/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" />
      </div>

      <p className="text-label-md text-pokeball-red tracking-[0.2em] uppercase flex items-center gap-2">
        <span className="material-symbols-outlined animate-spin text-[20px]">autorenew</span>
        {label}
      </p>
    </div>
  );
}
