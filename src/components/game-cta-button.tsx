"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type SharedProps = {
  children: ReactNode;
  icon?: string;
  className?: string;
  disabled?: boolean;
  variant?: "gold" | "red" | "secondary";
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
 * dorado, rojo o secondary, tipografía Grobold uppercase.
 * No usar para chips ni links secundarios de información.
 */
export function GameCtaButton(props: GameCtaButtonProps) {
  const { children, icon, className = "", disabled, variant = "gold" } = props;
  const variantClass =
    variant === "red"
      ? "game-cta--red"
      : variant === "secondary"
        ? "game-cta--secondary"
        : "";
  const classes = `game-cta ${variantClass} ${disabled ? "game-cta--disabled" : ""} ${className}`.trim();

  const content = (
    <>
      {icon ? (
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
