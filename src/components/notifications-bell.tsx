"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import type { NotificationDTO } from "@/lib/notifications";

const TYPE_META: Record<
  NotificationDTO["type"],
  { icon: string; accent: string; glow: string; labelKey: "sale" | "expired" | "gym" | "pvp" }
> = {
  MARKET_SOLD: {
    icon: "payments",
    accent: "from-electric-yellow/25 via-pokeball-red/20 to-transparent",
    glow: "shadow-[0_0_24px_rgba(250,204,21,0.18)]",
    labelKey: "sale",
  },
  MARKET_EXPIRED: {
    icon: "schedule",
    accent: "from-white/10 to-transparent",
    glow: "",
    labelKey: "expired",
  },
  GYM_WON: {
    icon: "military_tech",
    accent: "from-tertiary/25 to-transparent",
    glow: "shadow-[0_0_20px_rgba(52,211,153,0.15)]",
    labelKey: "gym",
  },
  GYM_LOST: {
    icon: "heart_broken",
    accent: "from-error/20 to-transparent",
    glow: "",
    labelKey: "gym",
  },
  PVP_WON: {
    icon: "sports_mma",
    accent: "from-pokeball-red/25 to-transparent",
    glow: "shadow-[0_0_20px_rgba(239,68,68,0.15)]",
    labelKey: "pvp",
  },
  PVP_LOST: {
    icon: "sports_mma",
    accent: "from-white/10 to-transparent",
    glow: "",
    labelKey: "pvp",
  },
};

function relativeTime(iso: string, t: ReturnType<typeof useTranslations<"notifications">>) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return t("justNow");
  if (mins < 60) return t("minutesAgo", { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t("hoursAgo", { n: hours });
  const days = Math.floor(hours / 24);
  return t("daysAgo", { n: days });
}

function headlineFor(
  item: NotificationDTO,
  t: ReturnType<typeof useTranslations<"notifications">>,
): string {
  const p = item.payload;
  switch (item.type) {
    case "MARKET_SOLD":
      return t("marketSoldTitle");
    case "MARKET_EXPIRED":
      return t("marketExpiredTitle");
    case "GYM_WON":
      return p.rematch ? t("gymWonRematchTitle") : t("gymWonTitle");
    case "GYM_LOST":
      return t("gymLostTitle");
    case "PVP_WON":
      return t("pvpWonTitle");
    case "PVP_LOST":
      return t("pvpLostTitle");
    default:
      return t("unknown");
  }
}

function detailFor(
  item: NotificationDTO,
  t: ReturnType<typeof useTranslations<"notifications">>,
): string {
  const p = item.payload;
  switch (item.type) {
    case "MARKET_SOLD":
      return t("marketSoldDetail", {
        buyer: p.buyerName ?? "?",
        item: p.itemName ?? "—",
      });
    case "MARKET_EXPIRED":
      return t("marketExpiredDetail", { item: p.itemName ?? "—" });
    case "GYM_WON":
      return p.rematch
        ? t("gymWonRematchDetail", { gym: p.gymName ?? "—", leader: p.leaderName ?? "—" })
        : t("gymWonDetail", { gym: p.gymName ?? "—", leader: p.leaderName ?? "—" });
    case "GYM_LOST":
      return t("gymLostDetail", { gym: p.gymName ?? "—", leader: p.leaderName ?? "—" });
    case "PVP_WON":
      return t("pvpWonDetail", { opponent: p.opponentName ?? "?" });
    case "PVP_LOST":
      return t("pvpLostDetail", { opponent: p.opponentName ?? "?" });
    default:
      return "";
  }
}

export function NotificationsBell({
  initialItems,
  initialUnread,
}: {
  initialItems: NotificationDTO[];
  initialUnread: number;
}) {
  const t = useTranslations("notifications");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const hasUnreadSale = items.some((i) => i.type === "MARKET_SOLD" && !i.readAt);

  useEffect(() => {
    setItems(initialItems);
    setUnread(initialUnread);
  }, [initialItems, initialUnread]);

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

  function openPanel() {
    setOpen((v) => {
      const next = !v;
      if (next && hasUnreadSale) router.refresh();
      return next;
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setUnread(0);
      setItems((prev) =>
        prev.map((item) => ({
          ...item,
          readAt: item.readAt ?? new Date().toISOString(),
        })),
      );
    });
  }

  function onItemClick(item: NotificationDTO) {
    if (!item.readAt) {
      startTransition(async () => {
        await markNotificationReadAction(item.id);
        setUnread((n) => Math.max(0, n - 1));
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, readAt: new Date().toISOString() } : row,
          ),
        );
      });
    }
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("title")}
        onClick={openPanel}
        className={`relative flex h-8 w-8 items-center justify-center rounded-md border transition ${
          hasUnreadSale
            ? "border-electric-yellow/50 bg-electric-yellow/10 text-electric-yellow"
            : "border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]!">notifications</span>
        {unread > 0 && (
          <span
            className={`absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-pokeball-red px-1 text-[10px] font-bold text-white ${
              hasUnreadSale ? "animate-pulse" : ""
            }`}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="absolute right-0 top-full z-[80] mt-2 flex w-[min(94vw,400px)] flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#070a10]/96 shadow-[0_28px_80px_rgba(0,0,0,0.65)] backdrop-blur-2xl"
        >
          <div className="relative overflow-hidden border-b border-white/10 px-4 py-3">
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-pokeball-red/15 via-transparent to-electric-yellow/10" />
            <div className="relative flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-electric-yellow/80">
                  {t("eyebrow")}
                </p>
                <h2 className="text-[17px] font-semibold tracking-tight text-white">{t("title")}</h2>
              </div>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-md border border-white/12 bg-white/5 px-2.5 py-1 text-[11px] font-medium text-on-surface-variant transition hover:border-white/25 hover:text-on-surface"
                >
                  {t("markAllRead")}
                </button>
              )}
            </div>
          </div>

          <ul className="max-h-[min(72vh,480px)] space-y-2 overflow-y-auto p-2.5">
            {items.length === 0 ? (
              <li className="rounded-xl border border-dashed border-white/10 px-4 py-12 text-center text-label-sm text-on-surface-variant">
                {t("empty")}
              </li>
            ) : (
              items.map((item) => {
                const meta = TYPE_META[item.type];
                const unreadItem = !item.readAt;
                const coins =
                  item.type === "MARKET_SOLD" && typeof item.payload.coins === "number"
                    ? item.payload.coins
                    : null;

                const card = (
                  <div
                    className={`relative overflow-hidden rounded-xl border transition ${
                      unreadItem
                        ? `border-white/14 bg-gradient-to-br ${meta.accent} ${meta.glow}`
                        : "border-white/6 bg-white/[0.02]"
                    } ${unreadItem && item.type === "MARKET_SOLD" ? "ring-1 ring-electric-yellow/25" : ""}`}
                  >
                    {unreadItem && item.type === "MARKET_SOLD" && (
                      <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-electric-yellow/20 blur-2xl" />
                    )}
                    <div className="relative flex gap-3 p-3">
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                          unreadItem
                            ? item.type === "MARKET_SOLD"
                              ? "border-electric-yellow/40 bg-electric-yellow/15 text-electric-yellow"
                              : "border-pokeball-red/40 bg-pokeball-red/15 text-pokeball-red"
                            : "border-white/10 bg-white/[0.03] text-on-surface-variant"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]!">{meta.icon}</span>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-on-surface-variant/80">
                              {t(`kind.${meta.labelKey}`)}
                            </p>
                            <p
                              className={`mt-0.5 text-[14px] font-semibold leading-tight ${
                                unreadItem ? "text-white" : "text-on-surface-variant"
                              }`}
                            >
                              {headlineFor(item, t)}
                            </p>
                          </div>
                          {unreadItem && (
                            <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-pokeball-red shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                          )}
                        </div>

                        <p className="mt-1 text-[12px] leading-snug text-on-surface-variant">
                          {detailFor(item, t)}
                        </p>

                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          {coins !== null && (
                            <span className="inline-flex items-center gap-1 rounded-md border border-electric-yellow/35 bg-electric-yellow/10 px-2 py-0.5 font-mono text-[12px] font-semibold text-electric-yellow">
                              <span className="material-symbols-outlined text-[14px]!">paid</span>+
                              {coins.toLocaleString()}
                            </span>
                          )}
                          <span className="text-[11px] text-on-surface-variant/60">
                            {relativeTime(item.createdAt, t)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <li key={item.id}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => onItemClick(item)}
                        className="block rounded-xl outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-pokeball-red/50"
                      >
                        {card}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onItemClick(item)}
                        className="block w-full rounded-xl text-left outline-none transition hover:brightness-110 focus-visible:ring-2 focus-visible:ring-pokeball-red/50"
                      >
                        {card}
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
