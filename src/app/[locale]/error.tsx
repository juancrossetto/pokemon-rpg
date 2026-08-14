"use client";

import { useEffect } from "react";

export default function LocaleError({ error, unstable_retry }: { error: Error & { digest?: string }; unstable_retry: () => void }) {
  useEffect(() => { console.error("[route-error]", error); }, [error]);
  const locale = typeof window === "undefined" ? "es" : window.location.pathname.split("/")[1];
  const copy = locale === "en"
    ? { title: "Something interrupted the game", body: "Your progress is safe. Retry the screen; if an update was installed, it will load automatically.", retry: "Try again", home: "Go home" }
    : locale === "pt"
      ? { title: "Algo interrompeu o jogo", body: "Seu progresso está seguro. Tente carregar a tela novamente.", retry: "Tentar novamente", home: "Ir ao início" }
      : { title: "Algo interrumpió el juego", body: "Tu progreso está seguro. Reintentá la pantalla; si había una actualización, se cargará automáticamente.", retry: "Reintentar", home: "Volver al inicio" };
  return <main className="flex min-h-[60dvh] flex-1 items-center justify-center px-5"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-[#15171d] p-6 text-center shadow-[0_25px_80px_rgba(0,0,0,.55)]"><span className="material-symbols-outlined rounded-2xl bg-primary/10 p-3 text-[34px]! text-primary">sync_problem</span><h1 className="mt-4 text-xl font-black text-white">{copy.title}</h1><p className="mt-2 text-sm leading-relaxed text-white/50">{copy.body}</p><div className="mt-5 grid gap-2 sm:grid-cols-2"><button type="button" onClick={() => unstable_retry()} className="ui-btn-primary px-4 py-2.5 text-sm font-bold">{copy.retry}</button><a href={`/${locale || "es"}`} className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white/70 hover:bg-white/5">{copy.home}</a></div>{error.digest ? <p className="mt-3 font-mono text-[9px] text-white/20">{error.digest}</p> : null}</section></main>;
}
