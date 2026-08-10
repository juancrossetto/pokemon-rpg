/**
 * Markup estático del splash. Server Component (sin "use client").
 * Mobile: wallpaper Mewtwo. Desktop: Pokéball. El % lo anima el warmup.
 */
export function BootSplashMarkup({
  label,
  pending = false,
}: {
  label: string;
  /** Alineado con `html.boot-splash-pending` del SSR. */
  pending?: boolean;
}) {
  return (
    <div
      id="boot-splash"
      className="boot-splash"
      role="progressbar"
      aria-live="polite"
      aria-busy={pending ? "true" : "false"}
      aria-hidden={pending ? "false" : "true"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      <div className="boot-splash__mobile">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/splash/boot.webp"
          alt=""
          className="boot-splash__art"
          fetchPriority="high"
          decoding="sync"
        />
        <div className="boot-splash__shade" aria-hidden />
        <div className="boot-splash__footer">
          <div className="boot-splash__meta">
            <span className="boot-splash__label">{label}</span>
            <span className="boot-splash__pct boot-splash-pct">0%</span>
          </div>
          <div className="boot-splash__track" aria-hidden>
            <div className="boot-splash__fill boot-splash-fill" style={{ width: "0%" }} />
          </div>
        </div>
      </div>

      <div className="boot-splash__desktop">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/loaders/pokeball-loader-transparent.webp"
          alt=""
          className="boot-splash__pokeball"
          width={360}
          height={270}
          fetchPriority="high"
          decoding="async"
        />
        <div className="boot-splash__footer boot-splash__footer--desktop">
          <div className="boot-splash__meta">
            <span className="boot-splash__label">{label}</span>
            <span className="boot-splash__pct boot-splash-pct">0%</span>
          </div>
          <div className="boot-splash__track" aria-hidden>
            <div className="boot-splash__fill boot-splash-fill" style={{ width: "0%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
