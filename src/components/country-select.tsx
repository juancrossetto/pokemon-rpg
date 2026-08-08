"use client";

import { useEffect, useState } from "react";
import { FlagIcon } from "@/components/flag-icon";
import { getCountryOptions, type CountryOption } from "@/lib/countries";

type CountrySelectProps = {
  label: string;
  labelIcon?: string;
  value: string;
  onChange: (code: string) => void;
  locale: string;
  required?: boolean;
  placeholder: string;
  /** Oculta el label visible y usa el estilo compacto del login. */
  compact?: boolean;
};

export function CountrySelect({
  label,
  labelIcon,
  value,
  onChange,
  locale,
  required,
  placeholder,
  compact = false,
}: CountrySelectProps) {
  // Intl.DisplayNames puede resolver un set/orden distinto entre el ICU de
  // Node (server render) y el del browser (hidratación) — no es solo el
  // comparador de sort, la lista en sí puede diferir. En vez de perseguir
  // esa divergencia, arrancamos vacío (igual en server y en la primera
  // pasada de cliente, sin mismatch posible) y lo llenamos recién montado,
  // que es una actualización normal post-hidratación, no parte del diff.
  const [options, setOptions] = useState<CountryOption[]>([]);

  useEffect(() => {
    // Deliberado: tiene que correr solo después de montar, nunca durante
    // SSR, para no reintroducir el mismatch de hidratación que esto arregla.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOptions(getCountryOptions(locale));
  }, [locale]);

  const selectClass = compact
    ? "auth-field w-full appearance-none rounded-lg border border-white/8 bg-white/[0.035] py-2.5 pl-10 pr-10 text-[15px] text-white outline-none transition focus:border-[color-mix(in_srgb,var(--theme-primary)_45%,transparent)] focus:bg-white/[0.055] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_14%,transparent)]"
    : "w-full appearance-none bg-black/60 border border-[#555] pl-11 pr-10 py-3 text-on-surface font-mono text-label-md focus:outline-none focus:border-electric-yellow focus:ring-1 focus:ring-electric-yellow/50 transition-all";

  return (
    <div>
      <label
        className={
          compact
            ? "sr-only"
            : "mb-1 flex items-center gap-1.5 text-label-sm uppercase tracking-wide text-electric-yellow"
        }
      >
        {!compact && labelIcon && (
          <span className="material-symbols-outlined text-[14px]!">{labelIcon}</span>
        )}
        {label}
      </label>
      <div className={`relative flex items-center${compact ? "" : " tech-border"}`}>
        <span className="pointer-events-none absolute left-3 flex items-center">
          {value ? (
            <FlagIcon code={value} className="h-4 w-auto rounded-sm shadow-sm" />
          ) : (
            <span
              className={`material-symbols-outlined text-[17px]! ${
                compact ? "text-white/35" : "text-on-surface-variant/70"
              }`}
            >
              travel_explore
            </span>
          )}
        </span>
        <select
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={selectClass}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
        </select>
        <span
          className={`material-symbols-outlined pointer-events-none absolute right-3 text-[17px]! ${
            compact ? "text-white/35" : "text-on-surface-variant/70"
          }`}
        >
          arrow_drop_down
        </span>
      </div>
    </div>
  );
}
