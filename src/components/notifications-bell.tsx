"use client";

import Image from "next/image";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";

const ACTION_BTN =
  "grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-[#ff8a00] to-[#f2c000] text-[#1a1200] shadow-[inset_0_1px_0_rgba(255,255,255,0.25)] transition hover:brightness-110 active:brightness-95";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { gymLeaderImageUrl } from "@/lib/gym-art";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type { NotificationDTO, NotificationImageKind } from "@/lib/notifications";

const PERSON_TYPES = new Set<NotificationDTO["type"]>([
  "PVP_WON",
  "PVP_LOST",
  "FRIEND_REQUEST",
  "FRIEND_ACCEPTED",
  "CLAN_INVITE",
  "CLAN_APPLICATION",
]);

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
    case "GYM_TM_REWARD":
      return t("gymTmRewardTitle");
    case "PVP_WON":
      return t("pvpWonTitle");
    case "PVP_LOST":
      return t("pvpLostTitle");
    case "FRIEND_REQUEST":
      return t("friendRequestTitle");
    case "FRIEND_ACCEPTED":
      return t("friendAcceptedTitle");
    case "CLAN_INVITE":
      return t("clanInviteTitle");
    case "CLAN_APPLICATION":
      return t("clanApplicationTitle");
    case "CLAN_ACCEPTED":
      return t("clanAcceptedTitle");
    case "CLAN_KICKED":
      return t("clanKickedTitle");
    case "CLAN_ROLE_CHANGED":
      return t("clanRoleChangedTitle");
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
    case "GYM_TM_REWARD":
      return t("gymTmRewardDetail", {
        item: p.itemName ?? "—",
        leader: p.leaderName ?? "—",
      });
    case "PVP_WON":
      return t("pvpWonDetail", { opponent: p.opponentName ?? "?" });
    case "PVP_LOST":
      return t("pvpLostDetail", { opponent: p.opponentName ?? "?" });
    case "FRIEND_REQUEST":
      return t("friendRequestDetail", { trainer: p.trainerName ?? "?" });
    case "FRIEND_ACCEPTED":
      return t("friendAcceptedDetail", { trainer: p.trainerName ?? "?" });
    case "CLAN_INVITE":
      return t("clanInviteDetail", {
        trainer: p.trainerName ?? "?",
        clanName: p.clanName ?? "—",
        clanTag: p.clanTag ?? "???",
      });
    case "CLAN_APPLICATION":
      return t("clanApplicationDetail", {
        trainer: p.trainerName ?? "?",
        clanName: p.clanName ?? "—",
        clanTag: p.clanTag ?? "???",
      });
    case "CLAN_ACCEPTED":
      return t("clanAcceptedDetail", {
        clanName: p.clanName ?? "—",
        clanTag: p.clanTag ?? "???",
      });
    case "CLAN_KICKED":
      return t("clanKickedDetail", {
        clanName: p.clanName ?? "—",
        clanTag: p.clanTag ?? "???",
      });
    case "CLAN_ROLE_CHANGED":
      return t("clanRoleChangedDetail", {
        clanName: p.clanName ?? "—",
        clanTag: p.clanTag ?? "???",
      });
    default:
      return "";
  }
}

type Media = { src: string; kind: NotificationImageKind };

function resolveMedia(item: NotificationDTO): Media | null {
  const p = item.payload;
  if (p.imageUrl) {
    return { src: p.imageUrl, kind: p.imageKind ?? "item" };
  }
  if (p.leaderName) {
    const leader = gymLeaderImageUrl(p.leaderName);
    if (leader) return { src: leader, kind: "leader" };
  }
  if (p.itemName) {
    const base = p.itemName.replace(/\s*×\d+\s*$/u, "").trim();
    if (base && base !== "—") return { src: itemSpriteUrl(base), kind: "item" };
  }
  return null;
}

function NotificationThumb({ item, unread }: { item: NotificationDTO; unread: boolean }) {
  const p = item.payload;
  const person = (p.opponentName ?? p.trainerName)?.trim() || null;
  const media = resolveMedia(item);
  const tag = p.clanTag?.slice(0, 3).toUpperCase();

  // PvP / amigos / clan con actor: mismo retrato que el resto de la app.
  if (person && (PERSON_TYPES.has(item.type) || media?.kind === "avatar")) {
    return (
      <TrainerAvatar
        name={person}
        src={media?.kind === "avatar" ? media.src : (p.imageUrl ?? null)}
        size="sm"
        className={unread ? "ring-1 ring-[#ff8a00]/50 rounded-[28%]" : undefined}
      />
    );
  }

  if (media) {
    const cover = media.kind === "leader";
    return (
      <span
        className={[
          "relative flex h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-[#151820]",
          unread ? "ring-1 ring-[#ff8a00]/50" : "ring-1 ring-white/10",
        ].join(" ")}
      >
        <Image
          src={media.src}
          alt=""
          fill
          sizes="44px"
          className={cover ? "object-cover object-top" : "object-contain p-1"}
          unoptimized={media.src.startsWith("http")}
        />
      </span>
    );
  }

  if (tag) {
    return (
      <span
        className={[
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg font-mono text-[11px] font-bold",
          unread
            ? "bg-[#ff8a00]/15 text-[#f2c000] ring-1 ring-[#ff8a00]/40"
            : "bg-white/[0.04] text-white/45 ring-1 ring-white/10",
        ].join(" ")}
      >
        {tag}
      </span>
    );
  }

  return (
    <span
      className={[
        "flex h-11 w-11 shrink-0 rounded-lg",
        unread
          ? "bg-[#ff8a00]/15 ring-1 ring-[#ff8a00]/35"
          : "bg-white/[0.04] ring-1 ring-white/10",
      ].join(" ")}
    />
  );
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

  const [lastServerItems, setLastServerItems] = useState(initialItems);
  if (lastServerItems !== initialItems) {
    setLastServerItems(initialItems);
    setItems(initialItems);
    setUnread(initialUnread);
  }

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

  function markOneRead(item: NotificationDTO) {
    if (item.readAt) return;
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

  function deleteOne(item: NotificationDTO) {
    startTransition(async () => {
      await deleteNotificationAction(item.id);
      if (!item.readAt) setUnread((n) => Math.max(0, n - 1));
      setItems((prev) => prev.filter((row) => row.id !== item.id));
    });
  }

  function onOpen(item: NotificationDTO) {
    markOneRead(item);
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
            ? "border-[#ff8a00]/55 bg-[#ff8a00]/10 text-[#f2c000]"
            : "border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]!">notifications</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-gradient-to-r from-[#ff8a00] to-[#f2c000] px-1 text-[10px] font-bold text-[#1a1200]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={t("title")}
          className="fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+0.35rem)] z-[80] flex max-h-[min(78dvh,560px)] w-auto flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14] shadow-[0_28px_80px_rgba(0,0,0,0.7)] xl:absolute xl:inset-x-auto xl:right-0 xl:top-full xl:mt-2 xl:max-h-none xl:w-[min(94vw,360px)]"
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/8 px-3.5 py-3">
            <h2 className="text-[15px] font-semibold text-white">{t("title")}</h2>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="rounded-md px-2.5 py-1 text-[11px] font-semibold text-[#f2c000] transition hover:bg-[#ff8a00]/15"
                >
                  {t("markAllRead")}
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("close")}
                className="grid h-7 w-7 place-items-center rounded-md text-white/45 transition hover:bg-white/8 hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]!">close</span>
              </button>
            </div>
          </header>

          <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2.5 xl:max-h-[min(62vh,420px)]">
            {items.length === 0 ? (
              <li className="rounded-xl border border-dashed border-white/10 px-3 py-10 text-center text-[13px] text-white/40">
                {t("empty")}
              </li>
            ) : (
              items.map((item) => {
                const unreadItem = !item.readAt;
                const coins =
                  item.type === "MARKET_SOLD" && typeof item.payload.coins === "number"
                    ? item.payload.coins
                    : null;
                const headline = headlineFor(item, t);
                const detail = detailFor(item, t);

                return (
                  <li key={item.id}>
                    <div
                      className={[
                        "flex items-center gap-2.5 overflow-hidden rounded-xl border px-2.5 py-2 transition",
                        unreadItem
                          ? "border-[#ff8a00]/30 bg-gradient-to-r from-[#ff8a00]/14 via-[#f2c000]/06 to-[#141820]"
                          : "border-white/8 bg-[#141820] hover:border-white/14",
                      ].join(" ")}
                    >
                      <NotificationThumb item={item} unread={unreadItem} />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p
                            className={[
                              "truncate text-[13px] font-semibold leading-tight",
                              unreadItem ? "text-white" : "text-white/75",
                            ].join(" ")}
                          >
                            {headline}
                          </p>
                          <span className="shrink-0 text-[10px] tabular-nums text-white/35">
                            {relativeTime(item.createdAt, t)}
                          </span>
                        </div>
                        {detail && (
                          <p className="mt-0.5 truncate text-[12px] leading-snug text-white/45">
                            {detail}
                          </p>
                        )}
                        {coins !== null && (
                          <p className="mt-1 text-[12px] font-semibold tabular-nums text-[#f2c000]">
                            +{coins.toLocaleString()}
                          </p>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-1 self-center">
                        {item.href ? (
                          <Link
                            href={item.href}
                            onClick={() => onOpen(item)}
                            aria-label={t("openAction")}
                            title={t("openAction")}
                            className={ACTION_BTN}
                          >
                            <span className="material-symbols-outlined text-[17px]!">
                              drafts
                            </span>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onOpen(item)}
                            aria-label={t("markRead")}
                            title={t("markRead")}
                            className={ACTION_BTN}
                          >
                            <span className="material-symbols-outlined text-[17px]!">
                              drafts
                            </span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => deleteOne(item)}
                          aria-label={t("deleteAction")}
                          title={t("deleteAction")}
                          className={ACTION_BTN}
                        >
                          <span className="material-symbols-outlined text-[17px]!">
                            delete
                          </span>
                        </button>
                      </div>
                    </div>
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
