"use client";

import Image from "next/image";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { useTypeLabel } from "@/hooks/use-type-label";
import { useRouter } from "next/navigation";
import { AvatarImage } from "@/components/avatar-image";
import { FlagIcon } from "@/components/flag-icon";
import { avatarById } from "@/lib/avatars";
import { uiSpriteUrl } from "@/lib/sprites";
import { typeColor } from "@/lib/type-colors";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/friend-rules";
import {
  PRESENCE_META,
  isPresenceOnlineish,
  type FriendFilter,
  type FriendListEntry,
  type FriendRequestEntry,
  type BlockedEntry,
  type FriendsHubSnapshot,
  type PlayerSearchHit,
  type PresenceStatus,
  type TrainerCardData,
} from "@/lib/friends";
import {
  acceptFriendRequest,
  blockTrainer,
  cancelFriendRequest,
  declineFriendRequest,
  fetchTrainerCard,
  heartbeatPresence,
  removeFriend,
  searchTrainers,
  sendFriendRequest,
  toggleFriendFavorite,
  unblockTrainer,
} from "@/actions/friends";

export type FriendsLabels = {
  community: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  friendsCount: string;
  onlineCount: string;
  requestsCount: string;
  searchPlaceholder: string;
  searchHint: string;
  searching: string;
  noResults: string;
  addFriend: string;
  requestSent: string;
  accept: string;
  decline: string;
  cancelRequest: string;
  filters: Record<FriendFilter, string>;
  presence: Record<PresenceStatus, string>;
  level: string;
  badges: string;
  emptyFriends: string;
  emptyFriendsHint: string;
  emptyFilter: string;
  emptyRequests: string;
  emptyBlocked: string;
  lastSeen: string;
  justNow: string;
  minutesAgo: string;
  hoursAgo: string;
  daysAgo: string;
  neverSeen: string;
  actions: {
    profile: string;
    favorite: string;
    unfavorite: string;
    invite: string;
    message: string;
    trade: string;
    gift: string;
    compare: string;
    remove: string;
    block: string;
    unblock: string;
  };
  comingSoon: string;
  card: {
    trainerCard: string;
    metrics: string;
    pokedex: string;
    gyms: string;
    pvp: string;
    power: string;
    hours: string;
    hoursSoon: string;
    squad: string;
    activity: string;
    noActivity: string;
    noFavorite: string;
    noSquad: string;
    memberSince: string;
    close: string;
    favorite: string;
    cp: string;
    rarity: Record<string, string>;
    titles: Record<string, string>;
    ranks: Record<string, string>;
    activityCatch: string;
    activityBadge: string;
    activityTrainer: string;
  };
  errors: Record<string, string>;
  confirmRemove: string;
  confirmBlock: string;
  toastSentTitle: string;
  toastSentDetail: string;
  toastAcceptedTitle: string;
  toastAcceptedDetail: string;
};

const FILTERS: FriendFilter[] = [
  "all",
  "online",
  "favorites",
  "recent",
  "requests",
  "blocked",
];

function avatarSrc(avatarId: string | null): string | null {
  return avatarById(avatarId)?.src ?? null;
}

function relativeTime(
  iso: string | null,
  labels: Pick<FriendsLabels, "justNow" | "minutesAgo" | "hoursAgo" | "daysAgo" | "neverSeen">,
): string {
  if (!iso) return labels.neverSeen;
  const age = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(age / 60_000);
  if (mins < 1) return labels.justNow;
  if (mins < 60) return labels.minutesAgo.replace("{n}", String(mins));
  const hours = Math.floor(mins / 60);
  if (hours < 48) return labels.hoursAgo.replace("{n}", String(hours));
  return labels.daysAgo.replace("{n}", String(Math.floor(hours / 24)));
}

function PresenceBadge({
  status,
  label,
}: {
  status: PresenceStatus;
  label: string;
}) {
  const meta = PRESENCE_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${meta.tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot} ${isPresenceOnlineish(status) ? "animate-pulse" : ""}`} />
      <span className="material-symbols-outlined text-[12px]!">{meta.icon === "circle" ? "radio_button_checked" : meta.icon}</span>
      {label}
    </span>
  );
}

export function FriendsHub({
  locale,
  initial,
  labels,
  initialFilter = "all",
}: {
  locale: string;
  initial: FriendsHubSnapshot;
  labels: FriendsLabels;
  initialFilter?: FriendFilter;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FriendFilter>(initialFilter);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PlayerSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [card, setCard] = useState<TrainerCardData | null>(null);
  const [cardLoading, setCardLoading] = useState(false);
  const [toast, setToast] = useState<{
    kind: "error" | "success";
    title: string;
    detail?: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = setInterval(() => {
      void heartbeatPresence();
    }, PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(() => {
      void searchTrainers(q).then((res) => {
        if (res.ok) setHits(res.hits);
        setSearching(false);
      });
    }, 280);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  function showToast(next: {
    kind: "error" | "success";
    title: string;
    detail?: string;
  }) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(next);
    toastTimer.current = setTimeout(() => setToast(null), 4500);
  }

  function flash(error?: string) {
    if (!error) return;
    showToast({
      kind: "error",
      title: labels.errors[error] ?? labels.errors.invalid ?? error,
    });
  }

  function run(
    action: () => Promise<{
      ok: boolean;
      error?: string;
      notice?: "sent" | "accepted";
    }>,
  ) {
    startTransition(async () => {
      const res = await action();
      if (!res.ok) {
        flash(res.error);
        return;
      }
      if (res.notice === "sent") {
        showToast({
          kind: "success",
          title: labels.toastSentTitle,
          detail: labels.toastSentDetail,
        });
      } else if (res.notice === "accepted") {
        showToast({
          kind: "success",
          title: labels.toastAcceptedTitle,
          detail: labels.toastAcceptedDetail,
        });
      }
      router.refresh();
    });
  }

  async function openCard(userId: string) {
    setCardLoading(true);
    const res = await fetchTrainerCard(userId);
    setCardLoading(false);
    if (!res.ok) {
      flash(res.error);
      return;
    }
    setCard(res.card);
  }

  const recentCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const filteredFriends = useMemo(() => {
    let list = [...initial.friends];
    if (filter === "online") list = list.filter((f) => isPresenceOnlineish(f.presence));
    if (filter === "favorites") list = list.filter((f) => f.isFavorite);
    if (filter === "recent") {
      list = list.filter((f) => new Date(f.friendsSince).getTime() >= recentCutoff);
    }
    const q = query.trim().toLowerCase();
    if (q && filter !== "requests" && filter !== "blocked") {
      list = list.filter(
        (f) =>
          f.username.toLowerCase().includes(q) ||
          f.userId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [initial.friends, filter, query, recentCutoff]);

  return (
    <div className="friends-hub relative flex flex-1 flex-col gap-5 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <header className="friends-hero relative overflow-hidden rounded-2xl border border-white/10 bg-glass-surface px-5 py-6 md:px-8 md:py-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(70% 90% at 8% 0%, rgba(238,21,21,0.22) 0%, transparent 55%), radial-gradient(50% 60% at 90% 20%, rgba(56,189,248,0.08) 0%, transparent 50%)",
          }}
        />
        <div className="relative z-[1] flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-400/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {labels.community}
            </p>
            <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-pokeball-red">
              <span className="material-symbols-outlined text-[16px]!">handshake</span>
              {labels.eyebrow}
            </p>
            <h1 className="text-headline-lg tracking-tight text-white md:text-display-lg">
              {labels.title}
            </h1>
            <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
              {labels.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 md:gap-3">
            <HeroStat
              label={labels.friendsCount}
              value={String(initial.counts.friends)}
              icon="group"
            />
            <HeroStat
              label={labels.onlineCount}
              value={String(initial.counts.online)}
              icon="sensors"
              accent="text-emerald-400"
            />
            <HeroStat
              label={labels.requestsCount}
              value={String(initial.counts.pendingIncoming)}
              icon="mark_email_unread"
              accent="text-tertiary"
            />
          </div>
        </div>
      </header>

      <div className="relative">
        <div className="friends-search flex items-center gap-3 rounded-2xl border border-white/10 bg-[#0c0e14]/90 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-md focus-within:border-pokeball-red/45">
          <span className="material-symbols-outlined text-on-surface-variant text-[22px]!">
            search
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={labels.searchPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-body-md text-white outline-none placeholder:text-on-surface-variant/70"
            autoComplete="off"
            spellCheck={false}
          />
          {searching ? (
            <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
              {labels.searching}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 px-1 text-[11px] text-on-surface-variant/80">
          {labels.searchHint}
        </p>

        {hits.length > 0 ? (
          <div className="friends-search-panel absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-[#0b0d13]/98 shadow-2xl backdrop-blur-xl">
            {hits.map((hit) => (
              <SearchRow
                key={hit.userId}
                hit={hit}
                labels={labels}
                pending={pending}
                onOpen={() => void openCard(hit.userId)}
                onAdd={() => run(() => sendFriendRequest(locale, hit.userId))}
                onAccept={() => {
                  const req = initial.requests.find(
                    (r) => r.direction === "incoming" && r.userId === hit.userId,
                  );
                  if (req) run(() => acceptFriendRequest(locale, req.id));
                }}
              />
            ))}
          </div>
        ) : query.trim().length >= 2 && !searching ? (
          <p className="mt-3 text-center text-body-sm text-on-surface-variant">
            {labels.noResults}
          </p>
        ) : null}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map((id) => {
          const active = filter === id;
          const badge =
            id === "requests"
              ? initial.counts.pendingIncoming
              : id === "blocked"
                ? initial.blocked.length
                : null;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] transition ${
                active
                  ? "border-pokeball-red/45 bg-pokeball-red/12 text-pokeball-red"
                  : "border-white/10 bg-white/[0.03] text-on-surface-variant hover:border-white/20 hover:text-white"
              }`}
            >
              {labels.filters[id]}
              {badge && badge > 0 ? (
                <span className="ml-1.5 rounded-full bg-pokeball-red/90 px-1.5 py-0.5 text-[9px] text-white">
                  {badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {filter === "requests" ? (
        <RequestsPanel
          requests={initial.requests}
          labels={labels}
          pending={pending}
          onOpen={openCard}
          onAccept={(id) => run(() => acceptFriendRequest(locale, id))}
          onDecline={(id) => run(() => declineFriendRequest(locale, id))}
          onCancel={(id) => run(() => cancelFriendRequest(locale, id))}
        />
      ) : filter === "blocked" ? (
        <BlockedPanel
          blocked={initial.blocked}
          labels={labels}
          pending={pending}
          onUnblock={(id) => run(() => unblockTrainer(locale, id))}
        />
      ) : filteredFriends.length === 0 ? (
        <EmptyState
          title={
            initial.friends.length === 0 ? labels.emptyFriends : labels.emptyFilter
          }
          hint={initial.friends.length === 0 ? labels.emptyFriendsHint : undefined}
          art={initial.friends.length === 0 ? "/events/friend-cubone.png" : undefined}
        />
      ) : (
        <div className="friends-grid grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredFriends.map((friend, index) => (
            <FriendCard
              key={friend.userId}
              friend={friend}
              labels={labels}
              style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
              onOpen={() => void openCard(friend.userId)}
              onFavorite={() => run(() => toggleFriendFavorite(locale, friend.userId))}
              onRemove={() => {
                if (!window.confirm(labels.confirmRemove)) return;
                run(() => removeFriend(locale, friend.userId));
              }}
              onBlock={() => {
                if (!window.confirm(labels.confirmBlock)) return;
                run(() => blockTrainer(locale, friend.userId));
              }}
            />
          ))}
        </div>
      )}

      {cardLoading ? (
        <div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
          <span className="material-symbols-outlined animate-spin text-pokeball-red text-[36px]!">
            progress_activity
          </span>
        </div>
      ) : null}

      {card ? (
        <TrainerCardModal
          card={card}
          labels={labels}
          pending={pending}
          onClose={() => setCard(null)}
          onFavorite={() =>
            run(async () => {
              const res = await toggleFriendFavorite(locale, card.userId);
              if (res.ok) {
                const next = await fetchTrainerCard(card.userId);
                if (next.ok) setCard(next.card);
              }
              return res;
            })
          }
          onRemove={() => {
            if (!window.confirm(labels.confirmRemove)) return;
            run(async () => {
              const res = await removeFriend(locale, card.userId);
              if (res.ok) setCard(null);
              return res;
            });
          }}
          onBlock={() => {
            if (!window.confirm(labels.confirmBlock)) return;
            run(async () => {
              const res = await blockTrainer(locale, card.userId);
              if (res.ok) setCard(null);
              return res;
            });
          }}
          onAdd={() =>
            run(async () => {
              const res = await sendFriendRequest(locale, card.userId);
              if (res.ok) {
                const next = await fetchTrainerCard(card.userId);
                if (next.ok) setCard(next.card);
              }
              return res;
            })
          }
        />
      ) : null}

      {toast ? (
        <div
          className="friend-toast-layer fixed inset-0 z-[60] flex items-center justify-center p-4"
          role="presentation"
          onClick={() => setToast(null)}
        >
          <div
            aria-hidden
            className="friend-toast-backdrop absolute inset-0 bg-black/55 backdrop-blur-[2px]"
          />
          <div
            role="status"
            onClick={(e) => e.stopPropagation()}
            className={`friend-toast relative z-[1] flex w-full max-w-[min(92vw,380px)] flex-col items-center gap-3 rounded-[1.35rem] border px-5 pb-5 pt-4 text-center shadow-[0_24px_64px_rgba(0,0,0,0.55)] ${
              toast.kind === "success"
                ? "border-fuchsia-400/30 bg-[#0c0a14]/96"
                : "border-pokeball-red/40 bg-[#12080a]/96"
            }`}
          >
            <button
              type="button"
              aria-label={labels.card.close}
              onClick={() => setToast(null)}
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full text-white/45 hover:bg-white/10 hover:text-white"
            >
              <span className="material-symbols-outlined text-[18px]!">close</span>
            </button>

            {toast.kind === "success" ? (
              <div className="relative mt-1">
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-fuchsia-400/25 blur-2xl"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/events/friend-message_mew.png"
                  alt=""
                  className="friend-toast-mew relative h-28 w-28 object-contain drop-shadow-[0_8px_24px_rgba(192,132,252,0.45)] sm:h-32 sm:w-32"
                />
              </div>
            ) : (
              <span className="mt-2 flex h-14 w-14 items-center justify-center rounded-2xl border border-pokeball-red/30 bg-pokeball-red/10 text-pokeball-red">
                <span className="material-symbols-outlined text-[28px]!">error</span>
              </span>
            )}

            <div className="min-w-0 px-1">
              <p className="text-[16px] font-semibold leading-snug text-white">
                {toast.title}
              </p>
              {toast.detail ? (
                <p className="mt-1.5 text-[13px] leading-snug text-on-surface-variant">
                  {toast.detail}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeroStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: string;
  accent?: string;
}) {
  return (
    <div className="min-w-[5.5rem] rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 backdrop-blur-sm">
      <p className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.16em] text-on-surface-variant">
        <span className={`material-symbols-outlined text-[12px]! ${accent ?? ""}`}>
          {icon}
        </span>
        {label}
      </p>
      <p className={`mt-1 text-headline-sm tabular-nums text-white ${accent ?? ""}`}>
        {value}
      </p>
    </div>
  );
}

function EmptyState({
  title,
  hint,
  art,
}: {
  title: string;
  hint?: string;
  art?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-16 text-center">
      {art ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={art}
          alt=""
          className="mb-4 h-24 w-24 object-contain drop-shadow-[0_8px_20px_rgba(238,21,21,0.25)] sm:h-28 sm:w-28"
        />
      ) : (
        <span className="material-symbols-outlined mb-3 text-pokeball-red/70 text-[40px]!">
          handshake
        </span>
      )}
      <p className="text-title-md text-white">{title}</p>
      {hint ? (
        <p className="mt-2 max-w-md text-body-sm text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

function SearchRow({
  hit,
  labels,
  pending,
  onOpen,
  onAdd,
  onAccept,
}: {
  hit: PlayerSearchHit;
  labels: FriendsLabels;
  pending: boolean;
  onOpen: () => void;
  onAdd: () => void;
  onAccept: () => void;
}) {
  const src = avatarSrc(hit.avatarId);
  return (
    <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-0">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-white/10 bg-surface-container">
          {src ? <AvatarImage src={src} alt={hit.username} className="h-full w-full object-cover" /> : null}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-white">{hit.username}</span>
            <FlagIcon code={hit.country} className="h-3 w-4" />
          </span>
          <span className="text-[11px] text-on-surface-variant">
            {labels.level} {hit.level}
          </span>
        </span>
      </button>
      {hit.relation === "none" ? (
        <button
          type="button"
          disabled={pending}
          onClick={onAdd}
          className="rounded-lg bg-pokeball-red px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white disabled:opacity-50"
        >
          {labels.addFriend}
        </button>
      ) : hit.relation === "incoming" ? (
        <button
          type="button"
          disabled={pending}
          onClick={onAccept}
          className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300"
        >
          {labels.accept}
        </button>
      ) : (
        <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">
          {hit.relation === "friend" ? labels.filters.all : labels.requestSent}
        </span>
      )}
    </div>
  );
}

function FriendCard({
  friend,
  labels,
  style,
  onOpen,
  onFavorite,
  onRemove,
  onBlock,
}: {
  friend: FriendListEntry;
  labels: FriendsLabels;
  style?: CSSProperties;
  onOpen: () => void;
  onFavorite: () => void;
  onRemove: () => void;
  onBlock: () => void;
}) {
  const src = avatarSrc(friend.avatarId);
  const favAccent = friend.favorite
    ? typeColor(friend.favorite.types[0] ?? "normal")
    : "rgba(238,21,21,0.35)";

  return (
    <article
      className="friends-card group relative overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/90 content-visibility-auto"
      style={
        {
          ...style,
          containIntrinsicSize: "0 148px",
          contentVisibility: "auto",
        } as CSSProperties
      }
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80 transition duration-500 group-hover:opacity-100"
        style={{
          background: `radial-gradient(80% 70% at 100% 0%, ${favAccent}33 0%, transparent 55%)`,
        }}
      />
      <button
        type="button"
        onClick={onOpen}
        className="relative z-[1] flex w-full gap-3 p-3.5 text-left"
      >
        <span className="relative shrink-0">
          <span className="flex h-14 w-14 overflow-hidden rounded-xl border border-white/15 bg-surface-container">
            {src ? (
              <AvatarImage src={src} alt={friend.username} className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-lg font-bold text-white/50">
                {friend.username.slice(0, 1).toUpperCase()}
              </span>
            )}
          </span>
          <span
            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#0c0e14] ${PRESENCE_META[friend.presence].dot}`}
          />
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-title-sm font-semibold text-white">
              {friend.username}
            </span>
            {friend.isFavorite ? (
              <span className="material-symbols-outlined text-tertiary text-[14px]!">star</span>
            ) : null}
            <FlagIcon code={friend.country} className="h-3 w-4 shrink-0" />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-on-surface-variant">
            <span className="tabular-nums text-white/80">
              {labels.level} {friend.level}
            </span>
            <span>·</span>
            <span>{labels.card.titles[friend.titleId] ?? friend.titleId}</span>
            <span>·</span>
            <span>{friend.regionLabel}</span>
          </span>
          <span className="mt-1.5 block">
            <PresenceBadge
              status={friend.presence}
              label={labels.presence[friend.presence]}
            />
          </span>
          <span className="mt-1 block text-[10px] text-on-surface-variant/80">
            {labels.lastSeen}{" "}
            {relativeTime(friend.lastSeenAt, labels)}
          </span>
        </span>

        {friend.favorite ? (
          <span className="relative hidden h-14 w-14 shrink-0 sm:block">
            <Image
              src={uiSpriteUrl(friend.favorite.spriteUrl, friend.favorite.isShiny)}
              alt={friend.favorite.name}
              width={56}
              height={56}
              className="friends-fav-idle h-full w-full object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]"
              unoptimized
            />
          </span>
        ) : null}
      </button>

      <div className="friends-actions absolute inset-x-0 bottom-0 z-[2] flex translate-y-full items-center justify-center gap-1 border-t border-white/10 bg-[#0b0d13]/95 px-2 py-2 opacity-0 backdrop-blur-md transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100">
        <ActionIcon label={labels.actions.profile} icon="badge" onClick={onOpen} />
        <ActionIcon
          label={friend.isFavorite ? labels.actions.unfavorite : labels.actions.favorite}
          icon={friend.isFavorite ? "star" : "star_outline"}
          onClick={onFavorite}
        />
        <ActionIcon label={labels.actions.invite} icon="swords" disabled title={labels.comingSoon} />
        <ActionIcon label={labels.actions.trade} icon="sync_alt" disabled title={labels.comingSoon} />
        <ActionIcon label={labels.actions.gift} icon="featured_seasonal_and_gifts" disabled title={labels.comingSoon} />
        <ActionIcon label={labels.actions.remove} icon="person_remove" onClick={onRemove} danger />
        <ActionIcon label={labels.actions.block} icon="block" onClick={onBlock} danger />
      </div>
    </article>
  );
}

function ActionIcon({
  label,
  icon,
  onClick,
  disabled,
  danger,
  title,
}: {
  label: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 transition disabled:cursor-not-allowed disabled:opacity-35 ${
        danger
          ? "text-pokeball-red hover:bg-pokeball-red/15"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      }`}
    >
      <span className="material-symbols-outlined text-[18px]!">{icon}</span>
    </button>
  );
}

function RequestsPanel({
  requests,
  labels,
  pending,
  onOpen,
  onAccept,
  onDecline,
  onCancel,
}: {
  requests: FriendRequestEntry[];
  labels: FriendsLabels;
  pending: boolean;
  onOpen: (id: string) => void;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  onCancel: (id: string) => void;
}) {
  if (requests.length === 0) {
    return <EmptyState title={labels.emptyRequests} />;
  }
  return (
    <div className="flex flex-col gap-2">
      {requests.map((r) => {
        const src = avatarSrc(r.avatarId);
        return (
          <div
            key={r.id}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-glass-surface px-4 py-3"
          >
            <button type="button" onClick={() => onOpen(r.userId)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
              <span className="flex h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-surface-container">
                {src ? <AvatarImage src={src} alt={r.username} className="h-full w-full object-cover" /> : null}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{r.username}</span>
                <span className="text-[11px] text-on-surface-variant">
                  {r.direction === "incoming" ? labels.filters.requests : labels.requestSent}
                  {" · "}
                  {labels.level} {r.level}
                </span>
              </span>
            </button>
            {r.direction === "incoming" ? (
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onAccept(r.id)}
                  className="rounded-lg bg-emerald-500/90 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
                >
                  {labels.accept}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onDecline(r.id)}
                  className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
                >
                  {labels.decline}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={pending}
                onClick={() => onCancel(r.id)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant"
              >
                {labels.cancelRequest}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BlockedPanel({
  blocked,
  labels,
  pending,
  onUnblock,
}: {
  blocked: BlockedEntry[];
  labels: FriendsLabels;
  pending: boolean;
  onUnblock: (id: string) => void;
}) {
  if (blocked.length === 0) return <EmptyState title={labels.emptyBlocked} />;
  return (
    <div className="flex flex-col gap-2">
      {blocked.map((b) => {
        const src = avatarSrc(b.avatarId);
        return (
          <div
            key={b.userId}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-glass-surface px-4 py-3"
          >
            <span className="flex h-11 w-11 overflow-hidden rounded-xl border border-white/10 bg-surface-container opacity-60">
              {src ? <AvatarImage src={src} alt={b.username} className="h-full w-full object-cover" /> : null}
            </span>
            <span className="min-w-0 flex-1 truncate font-semibold text-white/80">
              {b.username}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => onUnblock(b.userId)}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
            >
              {labels.actions.unblock}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function TrainerCardModal({
  card,
  labels,
  pending,
  onClose,
  onFavorite,
  onRemove,
  onBlock,
  onAdd,
}: {
  card: TrainerCardData;
  labels: FriendsLabels;
  pending: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onRemove: () => void;
  onBlock: () => void;
  onAdd: () => void;
}) {
  const typeLabel = useTypeLabel();
  const panelRef = useRef<HTMLDivElement>(null);
  const src = avatarSrc(card.avatarId);
  const fav = card.favorite;

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="friends-modal-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-md sm:items-center sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={labels.card.trainerCard}
        onClick={(e) => e.stopPropagation()}
        className="friends-modal-panel relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[1.75rem] border border-white/12 bg-[#090b11]/98 shadow-[0_30px_80px_rgba(0,0,0,0.55)] sm:max-h-[88vh] sm:rounded-[1.75rem]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: fav
              ? `radial-gradient(55% 50% at 18% 30%, ${fav.accent}33 0%, transparent 60%), radial-gradient(40% 40% at 85% 10%, rgba(238,21,21,0.18) 0%, transparent 50%)`
              : "radial-gradient(40% 40% at 85% 10%, rgba(238,21,21,0.18) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-[1] flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-6">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-pokeball-red">
            <span className="material-symbols-outlined text-[16px]!">id_card</span>
            {labels.card.trainerCard}
            {card.extensions.clanTag ? (
              <span className="rounded-md border border-white/15 px-1.5 py-0.5 text-white/70">
                [{card.extensions.clanTag}]
              </span>
            ) : null}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label={labels.card.close}
          >
            <span className="material-symbols-outlined text-[20px]!">close</span>
          </button>
        </div>

        <div className="relative z-[1] grid min-h-0 flex-1 overflow-y-auto lg:grid-cols-[0.9fr_1.15fr]">
          {/* Left — identity + favorite */}
          <div className="flex flex-col gap-4 border-b border-white/8 p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-start gap-4">
              <span className="relative shrink-0">
                <span className="flex h-20 w-20 overflow-hidden rounded-2xl border border-white/15 bg-surface-container shadow-[0_0_0_1px_rgba(238,21,21,0.25)]">
                  {src ? (
                    <AvatarImage src={src} alt={card.username} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-2xl font-bold text-white/40">
                      {card.username.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </span>
                <span
                  className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-[#090b11] ${PRESENCE_META[card.presence].dot}`}
                />
              </span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="truncate text-headline-sm text-white">{card.username}</h2>
                  <FlagIcon code={card.country} className="h-3.5 w-5" />
                </div>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-tertiary">
                  {labels.card.titles[card.titleId] ?? card.titleId}
                </p>
                <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-on-surface-variant">
                  <span className="text-white">
                    {labels.level} {card.level}
                  </span>
                  <span>{card.regionLabel}</span>
                  <span>{labels.card.ranks[card.rankTierId] ?? card.rankTierId}</span>
                </p>
                <div className="mt-2">
                  <PresenceBadge
                    status={card.presence}
                    label={labels.presence[card.presence]}
                  />
                </div>
              </div>
            </div>

            {fav ? (
              <div
                className="relative flex flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/30 px-4 py-6"
                style={{
                  boxShadow: `inset 0 0 40px ${fav.accent}22`,
                }}
              >
                <p className="absolute left-3 top-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">
                  {labels.card.favorite}
                </p>
                <div
                  aria-hidden
                  className="friends-fav-glow pointer-events-none absolute h-40 w-40 rounded-full blur-3xl"
                  style={{ background: fav.accent }}
                />
                <Image
                  src={uiSpriteUrl(fav.spriteUrl, fav.isShiny)}
                  alt={fav.name}
                  width={160}
                  height={160}
                  className="friends-fav-idle relative z-[1] h-36 w-36 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.45)]"
                  unoptimized
                />
                <p className="relative z-[1] mt-2 text-title-sm font-semibold text-white">
                  {fav.name}
                </p>
                <p className="relative z-[1] mt-1 flex gap-2 text-[11px] text-on-surface-variant">
                  <span>
                    {labels.level} {fav.level}
                  </span>
                  <span>
                    {labels.card.cp} {fav.cp}
                  </span>
                  <span>{labels.card.rarity[fav.rarity] ?? fav.rarity}</span>
                </p>
                <div className="relative z-[1] mt-2 flex gap-1">
                  {fav.types.map((ty) => (
                    <span
                      key={ty}
                      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white"
                      style={{ background: typeColor(ty) }}
                    >
                      {typeLabel(ty)}
                    </span>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 text-body-sm text-on-surface-variant">
                {labels.card.noFavorite}
              </div>
            )}
          </div>

          {/* Right — metrics, squad, activity, actions */}
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {labels.card.metrics}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric
                  label={labels.card.pokedex}
                  value={`${card.dexCaught}/${card.dexTotal}`}
                />
                <Metric label={labels.card.gyms} value={String(card.badgeCount)} />
                <Metric
                  label={labels.card.pvp}
                  value={`${card.pvpWins}W`}
                  hint={`${card.pvpRating}`}
                />
                <Metric
                  label={labels.card.hours}
                  value={card.hoursPlayed != null ? String(card.hoursPlayed) : "—"}
                  hint={card.hoursPlayed == null ? labels.card.hoursSoon : undefined}
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {labels.card.squad}
              </p>
              {card.squad.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">{labels.card.noSquad}</p>
              ) : (
                <div className="grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 6 }, (_, i) => {
                    const mon = card.squad.find((s) => s.slot === i + 1) ?? card.squad[i];
                    if (!mon) {
                      return (
                        <div
                          key={`empty-${i}`}
                          className="aspect-square rounded-xl border border-dashed border-white/10 bg-white/[0.02]"
                        />
                      );
                    }
                    const hpPct =
                      mon.maxHp > 0
                        ? Math.max(0, Math.min(100, (mon.currentHp / mon.maxHp) * 100))
                        : 0;
                    return (
                      <div
                        key={`${mon.slot}-${mon.name}`}
                        className="flex flex-col items-center rounded-xl border border-white/10 bg-black/25 p-1.5"
                        title={mon.name}
                      >
                        <Image
                          src={uiSpriteUrl(mon.spriteUrl, mon.isShiny)}
                          alt={mon.name}
                          width={40}
                          height={40}
                          className="h-9 w-9 object-contain"
                          unoptimized
                        />
                        <span className="text-[9px] tabular-nums text-white/80">
                          {labels.level} {mon.level}
                        </span>
                        <span className="mt-0.5 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
                          <span
                            className="block h-full rounded-full bg-emerald-400"
                            style={{ width: `${hpPct}%` }}
                          />
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">
                {labels.card.activity}
              </p>
              {card.activity.length === 0 ? (
                <p className="text-body-sm text-on-surface-variant">
                  {labels.card.noActivity}
                </p>
              ) : (
                <ul className="space-y-2">
                  {card.activity.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[12px] text-white">
                          {a.kind === "catch"
                            ? labels.card.activityCatch
                            : a.kind === "badge"
                              ? labels.card.activityBadge
                              : labels.card.activityTrainer}{" "}
                          <span className="font-semibold">{a.label}</span>
                        </span>
                        {a.detail ? (
                          <span className="text-[10px] text-on-surface-variant">
                            {a.detail}
                          </span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-[10px] text-on-surface-variant">
                        {relativeTime(a.at, labels)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-auto flex flex-wrap gap-2 border-t border-white/8 pt-4">
              {card.isFriend ? (
                <>
                  <ModalBtn
                    icon="featured_seasonal_and_gifts"
                    label={labels.actions.gift}
                    disabled
                    title={labels.comingSoon}
                  />
                  <ModalBtn
                    icon="swords"
                    label={labels.actions.invite}
                    disabled
                    title={labels.comingSoon}
                  />
                  <ModalBtn
                    icon="sync_alt"
                    label={labels.actions.trade}
                    disabled
                    title={labels.comingSoon}
                  />
                  <ModalBtn
                    icon={card.isFavorite ? "star" : "star_outline"}
                    label={
                      card.isFavorite
                        ? labels.actions.unfavorite
                        : labels.actions.favorite
                    }
                    onClick={onFavorite}
                    pending={pending}
                  />
                  <ModalBtn
                    icon="person_remove"
                    label={labels.actions.remove}
                    onClick={onRemove}
                    pending={pending}
                    danger
                  />
                </>
              ) : (
                <ModalBtn
                  icon="person_add"
                  label={labels.addFriend}
                  onClick={onAdd}
                  pending={pending}
                  primary
                />
              )}
              <ModalBtn
                icon="block"
                label={labels.actions.block}
                onClick={onBlock}
                pending={pending}
                danger
              />
              <ModalBtn icon="close" label={labels.card.close} onClick={onClose} />
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 px-3 py-2.5">
      <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 text-title-sm tabular-nums text-white">{value}</p>
      {hint ? (
        <p className="mt-0.5 text-[10px] text-on-surface-variant/80">{hint}</p>
      ) : null}
    </div>
  );
}

function ModalBtn({
  icon,
  label,
  onClick,
  disabled,
  pending,
  danger,
  primary,
  title,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  pending?: boolean;
  danger?: boolean;
  primary?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      disabled={disabled || pending}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] transition disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? "border-pokeball-red/50 bg-pokeball-red text-white"
          : danger
            ? "border-pokeball-red/30 text-pokeball-red hover:bg-pokeball-red/10"
            : "border-white/12 text-white/85 hover:bg-white/8"
      }`}
    >
      <span className="material-symbols-outlined text-[16px]!">{icon}</span>
      {label}
    </button>
  );
}
