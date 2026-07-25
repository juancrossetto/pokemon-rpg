"use client";

import { useEffect, useRef, useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";

export type DesktopNavLink = { href: string; label: string; icon?: string };

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  links,
  moreLinks,
  moreLabel,
}: {
  links: DesktopNavLink[];
  moreLinks: DesktopNavLink[];
  moreLabel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const moreActive = moreLinks.some((link) => isActive(pathname, link.href));

  return (
    <div className="ml-4 flex items-center gap-1">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`relative px-3 py-1 text-label-md whitespace-nowrap transition-colors ${
              active ? "text-white" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {link.label}
            {active && (
              <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-pokeball-red" />
            )}
          </Link>
        );
      })}

      {moreLinks.length > 0 && (
        <div ref={rootRef} className="relative">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-haspopup="menu"
            aria-expanded={open}
            className={`relative flex items-center gap-0.5 px-3 py-1 text-label-md whitespace-nowrap transition-colors ${
              moreActive || open ? "text-white" : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {moreLabel}
            <span
              className={`material-symbols-outlined text-[16px]! transition-transform ${
                open ? "rotate-180" : ""
              }`}
            >
              expand_more
            </span>
            {moreActive && (
              <span className="absolute inset-x-3 -bottom-0.5 h-0.5 rounded-full bg-pokeball-red" />
            )}
          </button>

          {open && (
            <div
              role="menu"
              className="absolute left-0 top-full z-50 mt-3 w-56 rounded-xl border border-white/10 bg-surface-container-low/98 p-1.5 shadow-2xl backdrop-blur-xl"
            >
              {moreLinks.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-label-md transition-colors ${
                      active
                        ? "bg-pokeball-red/10 text-white"
                        : "text-on-surface-variant hover:bg-white/5 hover:text-on-surface"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[18px]! text-pokeball-red">
                      {link.icon ?? "chevron_right"}
                    </span>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
