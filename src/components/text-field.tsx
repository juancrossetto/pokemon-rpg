"use client";

interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Ícono Material Symbols chico, delante del label (estilo registro). */
  labelIcon?: string;
  /** Texto de sistema a la derecha del label, ej. "SYS.REQ" / "ENCRYPTED". */
  meta?: string;
  /** Ícono Material Symbols dentro del input, a la izquierda. */
  icon?: string;
  /** Punto de estado a la derecha del input (estilo login). */
  statusDot?: boolean;
  hint?: string;
  /** Color de foco y del label. */
  accent?: "yellow" | "red";
}

export function TextField({
  label,
  labelIcon,
  meta,
  icon,
  statusDot,
  hint,
  accent = "yellow",
  ...inputProps
}: TextFieldProps) {
  const focusRing =
    accent === "red"
      ? "focus:border-pokeball-red focus:ring-pokeball-red/50"
      : "focus:border-electric-yellow focus:ring-electric-yellow/50";

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1 gap-2">
        <label className="flex items-center gap-1.5 text-label-sm text-electric-yellow uppercase tracking-wide">
          {labelIcon && <span className="material-symbols-outlined text-[14px]">{labelIcon}</span>}
          {label}
        </label>
        {meta && (
          <span className="text-label-sm text-[10px] text-on-surface-variant/50 font-mono uppercase shrink-0">
            {meta}
          </span>
        )}
      </div>

      <div className="relative tech-border">
        {icon && (
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-on-surface-variant/70 pointer-events-none">
            {icon}
          </span>
        )}
        <input
          {...inputProps}
          className={`w-full bg-black/60 border border-[#555] py-3 text-label-md font-mono text-on-surface focus:outline-none focus:ring-1 transition-all placeholder:text-on-surface-variant/40 ${focusRing} ${
            icon ? "pl-10" : "pl-4"
          } ${statusDot ? "pr-9" : "pr-4"}`}
        />
        {statusDot && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-pokeball-red/50 shadow-[0_0_5px_currentColor] pointer-events-none" />
        )}
      </div>

      {hint && <p className="mt-1 text-label-sm text-on-surface-variant/60">{hint}</p>}
    </div>
  );
}
