/**
 * Markup estático del splash. Server Component (sin "use client").
 *
 * Siempre sale con `--out` desde React: el soft-nav de idioma remonta este
 * layout y si SSR mandara `pending` se veía una pantalla negra sin spinner.
 * En cold start el script de revelado (justo debajo en el layout) quita
 * `--out` si el warmup aún no corrió.
 *
 * Mobile: video Charizard (poster estático para el primer paint). Desktop:
 * Pokéball. El % lo anima el warmup.
 *
 * Estilos inline de emergencia: si el CSS crítico aún no aplicó, el lienzo
 * ya es oscuro a pantalla completa (no blanco del UA).
 */
export function BootSplashMarkup({ label }: { label: string }) {
  return (
    <div
      id="boot-splash"
      className="boot-splash boot-splash--out"
      role="progressbar"
      aria-live="polite"
      aria-busy="false"
      aria-hidden="true"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        background: "#0a0806",
      }}
    >
      <div className="boot-splash__mobile">
        {/* eslint-disable-next-line @next/next/no-img-element -- poster inmediato sin JS */}
        <img
          src="/splash/boot.webp"
          alt=""
          className="boot-splash__art boot-splash__poster"
          fetchPriority="high"
          decoding="sync"
        />
        <video
          className="boot-splash__art boot-splash__video"
          muted
          loop
          playsInline
          preload="auto"
          poster="/splash/boot.webp"
          aria-hidden
        >
          <source src="/splash/charizard-boot.mp4" type="video/mp4" />
        </video>
        <div className="boot-splash__shade" aria-hidden />
        <div className="boot-splash__footer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            className="boot-splash__logo"
            width={220}
            height={72}
            decoding="async"
          />
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt=""
            className="boot-splash__logo"
            width={200}
            height={64}
            decoding="async"
          />
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
