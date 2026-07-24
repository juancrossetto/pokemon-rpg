import * as Flags from "country-flag-icons/react/3x2";
import { hasFlag } from "country-flag-icons";

type FlagProps = {
  code: string;
  title?: string;
  className?: string;
};

/** Bandera SVG por código ISO 3166-1 alpha-2 (AR, BR, US…). */
export function FlagIcon({ code, title, className = "h-4 w-auto" }: FlagProps) {
  const iso = code.toUpperCase();
  if (!hasFlag(iso)) return null;
  const Flag = Flags[iso as keyof typeof Flags];
  if (typeof Flag !== "function") return null;
  return <Flag title={title ?? iso} className={className} />;
}
