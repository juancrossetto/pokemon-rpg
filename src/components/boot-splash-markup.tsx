/**
 * Markup estático del splash. Server Component (sin "use client").
 * El progreso lo anima `BootSplashController` vía DOM.
 */
export function BootSplashMarkup() {
  return (
    <div
      id="boot-splash"
      className="boot-splash"
      role="status"
      aria-live="polite"
      aria-busy="false"
      aria-hidden="true"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={0}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/splash/boot.webp" alt="" className="boot-splash__art" fetchPriority="high" />
      <div className="boot-splash__shade" aria-hidden />
      <div className="boot-splash__footer">
        <div className="boot-splash__meta">
          <span className="boot-splash__label">Cargando</span>
          <span id="boot-splash-pct" className="boot-splash__pct">
            0%
          </span>
        </div>
        <div className="boot-splash__track" aria-hidden>
          <div id="boot-splash-fill" className="boot-splash__fill" style={{ width: "0%" }} />
        </div>
      </div>
    </div>
  );
}
