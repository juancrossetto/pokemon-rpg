import { runShowdownDemoBattle } from "@/lib/showdown-demo";
import { ShowdownDemoViewer } from "@/components/showdown-demo-viewer";

// Página aislada, NO linkeada desde ningún lado del juego real — spike para
// evaluar @pkmn/sim (motor real de Pokémon Showdown, extraído y MIT) como
// posible reemplazo del motor de batalla propio. Los equipos son fijos y
// no vienen de nuestro schema/Prisma — es solo para ver el nivel de detalle
// que el motor real puede dar (habilidades, objetos, estados, críticos).
export default async function ShowdownDemoPage() {
  const result = await runShowdownDemoBattle();

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-2xl">
        <p className="text-label-sm uppercase text-on-surface-variant mb-1">Spike técnico — no conectado al juego real</p>
        <h1 className="text-headline-lg md:text-display-lg text-white mb-2">Demo: motor de Pokémon Showdown</h1>
        <p className="text-label-md text-on-surface-variant mb-6">
          Charizard (Blaze, Carbón) vs Blastoise (Torrente, Restos) — equipos fijos, movimientos random,
          usando <code>@pkmn/sim</code> (extracción MIT del simulador real de Showdown) corriendo del todo en el
          servidor. No usa Prisma ni el schema del proyecto.
        </p>

        <ShowdownDemoViewer initialResult={result} />
      </div>
    </div>
  );
}
