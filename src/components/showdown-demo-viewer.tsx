"use client";

import { useActionState } from "react";
import { runShowdownDemo } from "@/actions/run-showdown-demo";
import type { ShowdownDemoResult } from "@/lib/showdown-demo";

// Traducciones mínimas del protocolo de Showdown a texto legible — no cubre
// todo el protocolo (no hace falta para el spike), solo lo suficiente para
// que se lea como un log de batalla en vez de líneas crípticas con |.
function readableLine(line: string): string | null {
  const parts = line.split("|");
  const type = parts[1];
  switch (type) {
    case "move":
      return `${parts[2]} usó ${parts[3]} contra ${parts[4]}`;
    case "-damage":
      return `${parts[2]} quedó en ${parts[3]} HP`;
    case "-heal":
      return `${parts[2]} se curó a ${parts[3]} HP ${parts[4] ?? ""}`;
    case "-status":
      return `${parts[2]} quedó con estado: ${parts[3]}`;
    case "-crit":
      return `¡Golpe crítico contra ${parts[2]}!`;
    case "-boost":
      return `${parts[2]} subió ${parts[3]} (+${parts[4]})`;
    case "-miss":
      return `${parts[2]} falló el golpe`;
    case "faint":
      return `¡${parts[2]} se debilitó!`;
    case "turn":
      return `— Turno ${parts[2]} —`;
    case "win":
      return `¡${parts[2]} ganó la batalla!`;
    case "switch":
      return `¡Adelante, ${parts[3]}!`;
    default:
      return null;
  }
}

export function ShowdownDemoViewer({ initialResult }: { initialResult: ShowdownDemoResult }) {
  const [result, formAction, pending] = useActionState<ShowdownDemoResult>(
    async () => runShowdownDemo(),
    initialResult,
  );

  const readableLines = result.log.map(readableLine).filter((l): l is string => l !== null);

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-panel rounded-xl border border-white/10 p-4 max-h-[420px] overflow-y-auto font-mono text-label-sm text-on-surface flex flex-col gap-1">
        {readableLines.map((line, i) => (
          <p key={i} className={line.startsWith("—") ? "text-tertiary uppercase mt-2" : line.startsWith("¡") ? "text-pokeball-red" : ""}>
            {line}
          </p>
        ))}
      </div>

      <p className="text-label-sm text-on-surface-variant">
        Resuelto en {result.durationMs}ms · {result.log.length} líneas de protocolo crudo
      </p>

      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors disabled:opacity-50"
        >
          {pending ? "Simulando..." : "Nueva batalla"}
        </button>
      </form>

      <details className="glass-panel rounded-xl border border-white/10 p-4">
        <summary className="cursor-pointer text-label-sm text-on-surface-variant">
          Ver protocolo crudo de Showdown ({result.log.length} líneas)
        </summary>
        <pre className="mt-3 max-h-[300px] overflow-y-auto font-mono text-[11px] text-on-surface-variant whitespace-pre-wrap">
          {result.log.join("\n")}
        </pre>
      </details>
    </div>
  );
}
