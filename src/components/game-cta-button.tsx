"use client";

import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { Link } from "@/i18n/navigation";

type SharedProps = {
  children: ReactNode;
  icon?: string;
  className?: string;
  disabled?: boolean;
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

/**
 * CTA principal estilo "juego nativo" (Clash-like):
 * degradé amarillo→naranja, labio 3D y tipografía cartoon.
 * Usar en acciones primarias; no para chips ni links secundarios.
 */
export function GameCtaButton(props: GameCtaButtonProps) {
  const { children, icon, className = "", disabled } = props;
  const classes = `game-cta ${disabled ? "game-cta--disabled" : ""} ${className}`.trim();

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

  const { href: _h, icon: _i, className: _c, children: _ch, ...buttonProps } = props as AsButton;
  return (
    <button {...buttonProps} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}
