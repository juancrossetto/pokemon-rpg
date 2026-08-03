"use client";

import Image from "next/image";
import {
  useEffect,
  useRef,
  useState,
  useTransition,
  type AnimationEvent,
} from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  deleteNotificationAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import { openDailyRewardModal } from "@/lib/daily-gift-fx";
import { TrainerAvatar } from "@/components/trainer-avatar";
import { gymLeaderImageUrl } from "@/lib/gym-art";
import { itemSpriteUrl } from "@/lib/item-sprites";
import type { NotificationDTO, NotificationImageKind } from "@/lib/notifications";

const ACTION_BTN =
  "grid h-6 w-6 place-items-center rounded-md bg-gradient-to-br from-pokeball-red to-[color-mix(in_srgb,var(--color-pokeball-red)_55%,white)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] transition hover:brightness-110 active:brightness-95";

type PanelPhase = "closed" | "open" | "closing";
type Section = "unread" | "read";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

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
    case "DAILY_REWARD_READY":
      return t("dailyRewardReadyTitle");
    case "ENERGY_FULL":
      return t("energyFullTitle");
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
    case "DAILY_REWARD_READY":
      return t("dailyRewardReadyDetail");
    case "ENERGY_FULL":
      return t("energyFullDetail");
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
        size="xs"
        className={unread ? "ring-1 ring-pokeball-red/50 rounded-[28%]" : undefined}
      />
    );
  }

  if (media) {
    const cover = media.kind === "leader";
    return (
      <span
        className={[
          "relative flex h-9 w-9 shrink-0 overflow-hidden rounded-md bg-[#151820]",
          unread ? "ring-1 ring-pokeball-red/50" : "ring-1 ring-white/10",
        ].join(" ")}
      >
        <Image
          src={media.src}
          alt=""
          fill
          sizes="36px"
          className={cover ? "object-cover object-top" : "object-contain p-0.5"}
          unoptimized={media.src.startsWith("http")}
        />
      </span>
    );
  }

  if (tag) {
    return (
      <span
        className={[
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-mono text-[10px] font-bold",
          unread
            ? "bg-pokeball-red/15 text-white ring-1 ring-pokeball-red/40"
            : "bg-white/4 text-white/45 ring-1 ring-white/10",
        ].join(" ")}
      >
        {tag}
      </span>
    );
  }

  return (
    <span
      className={[
        "flex h-9 w-9 shrink-0 rounded-md",
        unread
          ? "bg-pokeball-red/15 ring-1 ring-pokeball-red/35"
          : "bg-white/4 ring-1 ring-white/10",
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
  const [phase, setPhase] = useState<PanelPhase>("closed");
  const [section, setSection] = useState<Section>("unread");
  const [items, setItems] = useState(initialItems);
  const [unread, setUnread] = useState(initialUnread);
  const [, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const open = phase === "open";
  const panelVisible = phase !== "closed";
  const unreadItems = items.filter((i) => !i.readAt);
  const readItems = items.filter((i) => !!i.readAt);
  const visibleItems = section === "unread" ? unreadItems : readItems;
  const hasUnreadSale = unreadItems.some((i) => i.type === "MARKET_SOLD");

  const [lastServerItems, setLastServerItems] = useState(initialItems);
  if (lastServerItems !== initialItems) {
    setLastServerItems(initialItems);
    setItems(initialItems);
    setUnread(initialUnread);
  }

  function requestClose() {
    setPhase((current) => {
      if (current !== "open") return current;
      return prefersReducedMotion() ? "closed" : "closing";
    });
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) requestClose();
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") requestClose();
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function togglePanel() {
    if (phase === "closing") return;
    if (phase === "open") {
      requestClose();
      return;
    }
    setSection("unread");
    setPhase("open");
    if (hasUnreadSale) router.refresh();
  }

  function onPanelAnimationEnd(event: AnimationEvent<HTMLDivElement>) {
    if (event.target !== panelRef.current) return;
    if (
      event.animationName &&
      !event.animationName.includes("notifications-panel-out")
    ) {
      return;
    }
    setPhase((current) => (current === "closing" ? "closed" : current));
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

  function onNavigate(item: NotificationDTO) {
    markOneRead(item);
    requestClose();
    if (item.type === "DAILY_REWARD_READY") {
      openDailyRewardModal();
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={t("title")}
        onClick={togglePanel}
        className={`relative z-[81] flex h-8 w-8 items-center justify-center rounded-md border transition ${
          open || phase === "closing"
            ? "border-white/18 bg-[#0b0d13] text-on-surface shadow-[0_0_0_1px_rgba(255,255,255,0.04)_inset]"
            : hasUnreadSale
              ? "border-pokeball-red/55 bg-pokeball-red/10 text-white"
              : "border-white/10 bg-white/5 text-on-surface-variant hover:bg-white/10 hover:text-on-surface"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]!">notifications</span>
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-md bg-gradient-to-r from-pokeball-red to-[color-mix(in_srgb,var(--color-pokeball-red)_55%,white)] px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {panelVisible && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t("title")}
          onAnimationEnd={onPanelAnimationEnd}
          className={[
            "notifications-panel fixed inset-x-3 top-[calc(3.5rem+env(safe-area-inset-top)+0.35rem)] z-[80] w-auto xl:absolute xl:inset-x-auto xl:right-0 xl:top-full xl:mt-2 xl:w-[min(94vw,360px)]",
            phase === "closing" ? "is-closing" : "is-open",
          ].join(" ")}
        >
          <div className="relative flex max-h-[min(78dvh,560px)] w-full flex-col overflow-visible rounded-2xl border border-white/[0.07] bg-[#0b0d13] shadow-[0_28px_80px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)_inset] backdrop-blur-2xl xl:max-h-none">
            <svg
              aria-hidden
              viewBox="0 0 22 10"
              className="notifications-panel__caret pointer-events-none absolute -top-[9px] right-1.5 z-20 h-2.5 w-[22px] xl:right-[9px]"
            >
              <path
                d="M1 9.5 L11 1.2 L21 9.5"
                fill="none"
                stroke="rgba(255,255,255,0.16)"
                strokeWidth="1.1"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path d="M2.4 9.7 L11 2.35 L19.6 9.7 Z" fill="#0b0d13" />
            </svg>
            {/* Tapa el trazo del borde bajo el pico para que no se vea una costura. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-0 right-[11px] z-20 h-[2px] w-4 -translate-y-px bg-[#0b0d13] xl:right-[14px]"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-white/16 to-transparent"
            />
            <div className="flex min-h-0 max-h-[min(78dvh,560px)] flex-1 flex-col overflow-hidden rounded-2xl xl:max-h-none">
            <header className="relative flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.07] bg-gradient-to-b from-white/4 to-transparent px-3 py-2.5">
              <h2 className="text-[14px] font-semibold text-white">{t("title")}</h2>
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={markAllRead}
                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-pokeball-red transition hover:bg-pokeball-red/15"
                  >
                    {t("markAllRead")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label={t("close")}
                  className="grid h-6 w-6 place-items-center rounded-md text-white/45 transition hover:bg-white/8 hover:text-white"
                >
                  <span className="material-symbols-outlined text-[16px]!">close</span>
                </button>
              </div>
            </header>

            <div
              role="tablist"
              aria-label={t("title")}
              className="grid shrink-0 grid-cols-2 gap-0.5 border-b border-white/[0.07] p-1.5"
            >
              {(
                [
                  { id: "unread" as const, label: t("filterUnread"), count: unreadItems.length },
                  { id: "read" as const, label: t("filterRead"), count: readItems.length },
                ] as const
              ).map((tab) => {
                const active = section === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setSection(tab.id)}
                    className={[
                      "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold transition",
                      active
                        ? "bg-pokeball-red/18 text-white ring-1 ring-pokeball-red/35"
                        : "text-white/45 hover:bg-white/5 hover:text-white/70",
                    ].join(" ")}
                  >
                    {tab.label}
                    <span
                      className={[
                        "min-w-4 rounded px-1 text-[10px] tabular-nums",
                        active ? "bg-pokeball-red/25 text-white" : "bg-white/6 text-white/35",
                      ].join(" ")}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto p-1.5 xl:max-h-[min(62vh,420px)]">
              {items.length === 0 ? (
                <li className="rounded-lg border border-dashed border-white/10 px-3 py-8 text-center text-[12px] text-white/40">
                  {t("empty")}
                </li>
              ) : visibleItems.length === 0 ? (
                <li className="rounded-lg border border-dashed border-white/10 px-3 py-8 text-center text-[12px] text-white/40">
                  {section === "unread" ? t("emptyUnread") : t("emptyRead")}
                </li>
              ) : (
                visibleItems.map((item) => {
                  const unreadItem = !item.readAt;
                  const coins =
                    item.type === "MARKET_SOLD" &&
                    typeof item.payload.coins === "number"
                      ? item.payload.coins
                      : null;
                  const headline = headlineFor(item, t);
                  const detail = detailFor(item, t);

                  return (
                    <li key={item.id}>
                      <div
                        className={[
                          "flex items-center gap-2 overflow-hidden rounded-lg border px-2 py-1.5 transition",
                          unreadItem
                            ? "border-pokeball-red/28 bg-gradient-to-r from-pokeball-red/12 via-pokeball-red/5 to-[#141820]"
                            : "border-white/6 bg-[#141820]/80 hover:border-white/12",
                        ].join(" ")}
                      >
                        {item.href ? (
                          <Link
                            href={item.href}
                            onClick={() => onNavigate(item)}
                            className="flex min-w-0 flex-1 items-center gap-2 text-left"
                          >
                            <NotificationThumb item={item} unread={unreadItem} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-1.5">
                                <p
                                  className={[
                                    "truncate text-[12px] font-semibold leading-tight",
                                    unreadItem ? "text-white" : "text-white/70",
                                  ].join(" ")}
                                >
                                  {headline}
                                </p>
                                <span className="shrink-0 text-[9px] tabular-nums text-white/35">
                                  {relativeTime(item.createdAt, t)}
                                </span>
                              </div>
                              {detail && (
                                <p className="mt-px truncate text-[11px] leading-snug text-white/40">
                                  {detail}
                                </p>
                              )}
                              {coins !== null && (
                                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-tertiary">
                                  +{coins.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </Link>
                        ) : (
                          <>
                            <NotificationThumb item={item} unread={unreadItem} />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-baseline justify-between gap-1.5">
                                <p
                                  className={[
                                    "truncate text-[12px] font-semibold leading-tight",
                                    unreadItem ? "text-white" : "text-white/70",
                                  ].join(" ")}
                                >
                                  {headline}
                                </p>
                                <span className="shrink-0 text-[9px] tabular-nums text-white/35">
                                  {relativeTime(item.createdAt, t)}
                                </span>
                              </div>
                              {detail && (
                                <p className="mt-px truncate text-[11px] leading-snug text-white/40">
                                  {detail}
                                </p>
                              )}
                              {coins !== null && (
                                <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-tertiary">
                                  +{coins.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </>
                        )}

                        <div className="flex shrink-0 items-center gap-0.5 self-center">
                          {item.href ? (
                            <Link
                              href={item.href}
                              onClick={() => onNavigate(item)}
                              aria-label={t("openAction")}
                              title={t("openAction")}
                              className={ACTION_BTN}
                            >
                              <span className="material-symbols-outlined text-[14px]!">
                                {unreadItem ? "drafts" : "open_in_new"}
                              </span>
                            </Link>
                          ) : unreadItem ? (
                            <button
                              type="button"
                              onClick={() => markOneRead(item)}
                              aria-label={t("markRead")}
                              title={t("markRead")}
                              className={ACTION_BTN}
                            >
                              <span className="material-symbols-outlined text-[14px]!">
                                drafts
                              </span>
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => deleteOne(item)}
                            aria-label={t("deleteAction")}
                            title={t("deleteAction")}
                            className={ACTION_BTN}
                          >
                            <span className="material-symbols-outlined text-[14px]!">
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
          </div>
        </div>
      )}
    </div>
  );
}
