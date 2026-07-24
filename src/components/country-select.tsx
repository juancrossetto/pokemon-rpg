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
};

export function CountrySelect({
  label,
  labelIcon,
  value,
  onChange,
  locale,
  required,
  placeholder,
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

  return (
    <div>
      <label className="flex items-center gap-1.5 text-label-sm text-electric-yellow uppercase tracking-wide mb-1">
        {labelIcon && <span className="material-symbols-outlined text-[14px]">{labelIcon}</span>}
        {label}
      </label>
      <div className="relative tech-border flex items-center">
        <span className="absolute left-3 pointer-events-none flex items-center">
          {value ? (
            <FlagIcon code={value} className="h-4 w-auto rounded-sm shadow-sm" />
          ) : (
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant/70">
              travel_explore
            </span>
          )}
        </span>
        <select
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none bg-black/60 border border-[#555] pl-11 pr-10 py-3 text-on-surface font-mono text-label-md focus:outline-none focus:border-electric-yellow focus:ring-1 focus:ring-electric-yellow/50 transition-all"
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
        <span className="material-symbols-outlined absolute right-3 text-on-surface-variant/70 text-[18px] pointer-events-none">
          arrow_drop_down
        </span>
      </div>
    </div>
  );
}
