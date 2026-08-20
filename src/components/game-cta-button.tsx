"use client";

import { CdnImage as Image } from "@/components/cdn-image";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

/** Ícono Material `explore` → brújula custom en CTAs de aventura. */
const EXPLORE_ICON_SRC = "/nav/compass-icon.png?v=2";

type SharedProps = {
  children: ReactNode;
  icon?: string;
  className?: string;
  disabled?: boolean;
  /**
   * `brand` = degradé primary → secondary, plano y saturado. Es el CTA del
   * home; vive aparte de `red` para no repintar de golpe el botón principal de
   * gimnasios, torre y combate, que usan la misma clase.
   */
  variant?: "gold" | "red" | "brand" | "secondary" | "gem";
};

type AsLink = SharedProps & {
  href: string;
  type?: never;
  onClick?: never;
};

type AsButton = SharedProps & {
  href?: undefined;
} & Omit<ComponentPropsWithoutRef<"button">, "className" | "children" | "disabled">;

export type GameCtaButtonProps = AsLink | AsButton;

const BUTTON_OMIT = new Set([
  "children",
  "icon",
  "className",
  "disabled",
  "variant",
  "href",
]);

/**
 * CTA principal de juego (Explorar / recompensa):
 * dorado, rojo o secondary, tipografía Orbitron uppercase.
 * No usar para chips ni links secundarios de información.
 */
export function GameCtaButton(props: GameCtaButtonProps) {
  const { children, icon, className = "", disabled, variant = "gold" } = props;
  const variantClass =
    variant === "red"
      ? "game-cta--red"
      : variant === "brand"
        ? "game-cta--brand"
        : variant === "secondary"
        ? "game-cta--secondary"
        : variant === "gem"
          ? "game-cta--gem"
          : "";
  const classes = `game-cta ${variantClass} ${disabled ? "game-cta--disabled" : ""} ${className}`.trim();

  const content = (
    <>
      {icon === "explore" ? (
        <Image
          src={EXPLORE_ICON_SRC}
          alt=""
          width={28}
          height={28}
          className="game-cta__icon shrink-0 object-contain"
          aria-hidden
        />
      ) : icon ? (
        <span className="material-symbols-outlined game-cta__icon" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="game-cta__label">{children}</span>
    </>
  );

  if ("href" in props && props.href) {
    if (disabled) {
      return (
        <span className={classes} aria-disabled="true">
          {content}
        </span>
      );
    }
    return (
      <Link href={props.href} className={classes}>
        {content}
      </Link>
    );
  }

  const buttonProps: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!BUTTON_OMIT.has(key)) buttonProps[key] = value;
  }

  return (
    <button
      {...(buttonProps as ComponentPropsWithoutRef<"button">)}
      disabled={disabled}
      className={classes}
    >
      {content}
    </button>
  );
}
