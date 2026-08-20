export function RouteLoadingSkeleton({
  variant = "dashboard",
}: {
  variant?: "dashboard" | "pokedex" | "campaign";
}) {
  const titleWidth = variant === "pokedex" ? "w-48" : "w-36";
  return (
    <main
      className="route-loading-shell flex-1 px-margin-mobile py-4 md:px-margin-desktop md:py-6"
      aria-busy="true"
      aria-label="Cargando"
    >
      <div className="mx-auto w-full max-w-7xl animate-pulse">
        <div className={`mb-3 h-7 rounded-full bg-white/10 ${titleWidth}`} />
        <div
          className={[
            "route-loading-shell__hero rounded-3xl",
            variant === "pokedex" ? "h-28 md:h-36" : "h-36 md:h-52",
          ].join(" ")}
        />
        <div className="mt-4 grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="hidden space-y-3 xl:block">
            <div className="route-loading-shell__panel h-40 rounded-2xl" />
            <div className="route-loading-shell__panel h-52 rounded-2xl" />
          </aside>
          <section className="min-w-0">
            <div className="mb-3 h-5 w-36 rounded-full bg-white/10" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="route-loading-shell__panel aspect-[4/3] rounded-2xl"
                />
              ))}
            </div>
          </section>
        </div>
      </div>
      <span className="sr-only">Cargando contenido</span>
    </main>
  );
}
