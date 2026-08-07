import { localizedMoveName } from "@/lib/move-i18n";

/** "thunder-shock" → nombre localizado, o "Thunder Shock" si no hay catálogo. */
export function formatMoveName(name: string, locale?: string | null): string {
  const localized = localizedMoveName(name, locale);
  if (localized) return localized;
  return name
    .trim()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
