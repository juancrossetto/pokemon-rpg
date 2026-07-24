import { countries as allCountryCodes } from "country-flag-icons";

// Países priorizados (Latam + Iberia + comunes) — aparecen primero en el select.
const PRIORITY = [
  "AR",
  "BO",
  "BR",
  "CL",
  "CO",
  "CR",
  "CU",
  "DO",
  "EC",
  "SV",
  "GT",
  "HN",
  "MX",
  "NI",
  "PA",
  "PY",
  "PE",
  "PR",
  "UY",
  "VE",
  "ES",
  "PT",
  "US",
  "CA",
] as const;

// Idioma de la UI → bandera representativa (no es el país del jugador).
export const LOCALE_FLAG: Record<"es" | "en" | "pt", string> = {
  es: "ES",
  en: "US",
  pt: "BR",
};

export type CountryOption = { code: string; name: string };

// Clave de orden sin diacríticos y sin pasar por Intl.Collator — Node y el
// browser pueden traer versiones de CLDR distintas, así que ordenar con
// localeCompare(locale) da resultados diferentes entre server y client
// (ej. "Hong Kong" vs "Hungría" cambiaban de lugar) → warning real de
// hidratación de React. Comparación plana de códigos Unicode = mismo
// resultado siempre, en cualquier entorno.
function sortKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function getCountryOptions(locale: string): CountryOption[] {
  const display = new Intl.DisplayNames([locale], { type: "region" });
  const priority = new Set<string>(PRIORITY);

  const named = allCountryCodes
    .filter((code) => code.length === 2)
    .map((code) => ({
      code,
      name: display.of(code) ?? code,
    }))
    .filter((c) => c.name !== c.code); // descarta códigos sin nombre usable

  const preferred = PRIORITY.map((code) => named.find((c) => c.code === code)).filter(
    (c): c is CountryOption => c !== undefined,
  );
  const rest = named
    .filter((c) => !priority.has(c.code))
    .sort((a, b) => {
      const ka = sortKey(a.name);
      const kb = sortKey(b.name);
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

  return [...preferred, ...rest];
}
