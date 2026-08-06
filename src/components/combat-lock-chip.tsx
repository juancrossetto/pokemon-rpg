import Image from "next/image";
import { Link } from "@/i18n/navigation";

export type CombatLockKind = "battle" | "gym" | "tower";

/**
 * Chip del navbar cuando la navegación está bloqueada por un combate activo.
 * Es un CTA a la sesión, no un aviso pasivo.
 */
export function CombatLockChip({
  href,
  label,
  hint,
  returnLabel,
  iconSrc,
  kind,
}: {
  href: string;
  label: string;
  hint: string | null;
  returnLabel: string;
  iconSrc: string | null;
  kind: CombatLockKind;
}) {
  return (
    <Link
      href={href}
      className={`combat-lock-chip combat-lock-chip--${kind}`}
      title={hint ?? label}
      aria-label={hint ? `${label}. ${hint}` : label}
    >
      <span className="combat-lock-chip__live" aria-hidden>
        <span className="combat-lock-chip__live-dot" />
      </span>

      <span className="combat-lock-chip__icon" aria-hidden>
        {iconSrc ? (
          <Image
            src={iconSrc}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 object-contain"
            unoptimized
          />
        ) : (
          <span className="material-symbols-outlined text-[18px]!">
            {kind === "gym" ? "military_tech" : "swords"}
          </span>
        )}
      </span>

      <span className="combat-lock-chip__copy">
        <span className="combat-lock-chip__label">{label}</span>
        <span className="combat-lock-chip__action">
          {returnLabel}
          <span className="material-symbols-outlined combat-lock-chip__chevron" aria-hidden>
            arrow_forward
          </span>
        </span>
      </span>
    </Link>
  );
}
