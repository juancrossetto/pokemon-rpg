"use client";

import { FlagIcon } from "@/components/flag-icon";
import { getCountryOptions } from "@/lib/countries";

type CountrySelectProps = {
  label: string;
  value: string;
  onChange: (code: string) => void;
  locale: string;
  required?: boolean;
  placeholder: string;
};

export function CountrySelect({
  label,
  value,
  onChange,
  locale,
  required,
  placeholder,
}: CountrySelectProps) {
  const options = getCountryOptions(locale);

  return (
    <div>
      <label className="block text-label-sm text-on-surface-variant uppercase tracking-wide mb-1">
        {label}
      </label>
      <div className="relative flex items-center gap-2">
        <span className="absolute left-3 pointer-events-none flex items-center">
          {value ? (
            <FlagIcon code={value} className="h-4 w-auto rounded-sm shadow-sm" />
          ) : (
            <span className="block h-4 w-6 rounded-sm bg-white/10" aria-hidden />
          )}
        </span>
        <select
          required={required}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none rounded-lg bg-surface-container-high/60 border border-white/10 pl-11 pr-8 py-2 text-on-surface font-mono text-label-md focus:outline-none focus:border-pokeball-red focus:ring-1 focus:ring-pokeball-red"
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
        <span className="material-symbols-outlined absolute right-2 text-on-surface-variant text-[18px] pointer-events-none">
          expand_more
        </span>
      </div>
    </div>
  );
}
