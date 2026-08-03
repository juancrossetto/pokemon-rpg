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
import { FlagIcon } from "@/components/flag-icon";
import { TrainerAvatar } from "@/components/trainer-avatar";
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
import { type RankTierId } from "@/lib/trainer-profile";

/** Color flúor del tipo para la placa lateral (más vivo que typeColor base). */
const TYPE_RAIL_FLUOR: Record<string, string> = {
  normal: "#d4d48a",
  fire: "#ff7a28",
  water: "#4a9fff",
  electric: "#ffe14a",
  grass: "#6dff4a",
  ice: "#7ef0f0",
  fighting: "#ff4a3a",
  poison: "#c44aff",
  ground: "#f0c45a",
  flying: "#b49aff",
  psychic: "#ff5aa8",
  bug: "#c4e832",
  rock: "#d4b04a",
  ghost: "#9a6aff",
  dragon: "#7a4aff",
  dark: "#8a6a8a",
  steel: "#c8d0e8",
  fairy: "#ff9ac4",
};

function railFluorForType(type: string | null): string | null {
  if (!type) return null;
  return TYPE_RAIL_FLUOR[type] ?? typeColor(type);
}

/** Tipos oscuros: tinta clara sobre la placa flúor. */
const RAIL_LIGHT_INK_TYPES = new Set([
  "dark",
  "ghost",
  "dragon",
  "poison",
  "fighting",
  "rock",
]);

/** Paleta de respaldo si no hay Pokémon principal. */
const RANK_RAIL_FALLBACK: Record<RankTierId, { plate: string; ink: string }> = {
  bronze: { plate: "#9a7a52", ink: "#1c140e" },
  silver: { plate: "#9aa3ad", ink: "#15181c" },
  gold: { plate: "#c4a45a", ink: "#1a150a" },
  diamond: { plate: "#7f9aa4", ink: "#101518" },
  master: { plate: "#8b7d9e", ink: "#141018" },
  champion: { plate: "#a86b6b", ink: "#1a1010" },
};

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
  "favorites",
  "requests",
  "blocked",
];

function avatarSrc(avatarId: string | null): string | null {
  return avatarById(avatarId)?.src ?? null;
}

/** Cuerpo completo recortado — misma arte que el banner del perfil. */
function avatarStageSrc(avatarId: string | null): string | null {
  const av = avatarById(avatarId);
  return av?.stageSrc ?? av?.profileSrc ?? null;
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
  const filterRailRef = useRef<HTMLDivElement>(null);
  const [filterIndicator, setFilterIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  useEffect(() => {
    const root = filterRailRef.current;
    if (!root) return;

    function measure() {
      const node = root?.querySelector<HTMLElement>("[data-active]");
      if (!node || !root) {
        setFilterIndicator(null);
        return;
      }
      const rootBox = root.getBoundingClientRect();
      const box = node.getBoundingClientRect();
      const inset = 2;
      setFilterIndicator({
        left: box.left - rootBox.left + inset,
        width: Math.max(0, box.width - inset * 2),
      });
    }

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, [filter, labels.filters, initial.counts.pendingIncoming, initial.blocked.length]);

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

  const filteredFriends = useMemo(() => {
    let list = [...initial.friends];
    if (filter === "favorites") list = list.filter((f) => f.isFavorite);
    const q = query.trim().toLowerCase();
    if (q && filter !== "requests" && filter !== "blocked") {
      list = list.filter(
        (f) =>
          f.username.toLowerCase().includes(q) ||
          f.userId.toLowerCase().includes(q),
      );
    }
    return list;
  }, [initial.friends, filter, query]);

  return (
    <div className="friends-hub relative flex flex-1 flex-col gap-5 px-margin-mobile py-6 md:px-margin-desktop md:py-8">
      <header className="friends-hero relative isolate overflow-hidden rounded-2xl border border-white/10">
        <Image
          src="/friends/friends-banner.webp"
          alt=""
          fill
          priority
          sizes="(max-width: 1280px) 100vw, 1152px"
          className="object-cover object-[72%_42%] sm:object-[center_55%]"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-r from-[#0b0d13]/88 via-[#0b0d13]/55 to-[#0b0d13]/20 max-sm:from-[#0b0d13]/80 max-sm:via-[#0b0d13]/45 max-sm:to-transparent"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-t from-[#0b0d13]/92 via-[#0b0d13]/25 to-[#0b0d13]/15"
        />
        <div className="relative z-[1] flex min-h-[9.5rem] flex-col justify-end gap-3 px-4 py-4 sm:min-h-[12rem] sm:gap-5 sm:px-5 sm:py-6 md:flex-row md:items-end md:justify-between md:px-8 md:py-7">
          <div>
            <p className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-emerald-400/90">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              {labels.community}
            </p>
            <p className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff6a00]">
              <span className="material-symbols-outlined text-[16px]!">handshake</span>
              {labels.eyebrow}
            </p>
            <h1 className="page-title text-headline-md text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)] sm:text-headline-lg md:text-display-lg">
              {labels.title}
            </h1>
            <p className="mt-2 hidden max-w-xl text-body-md text-white/75 sm:block">
              {labels.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3">
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
        <p className="mt-1.5 hidden px-1 text-[11px] text-on-surface-variant/80 sm:block">
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

      <div
        ref={filterRailRef}
        role="tablist"
        aria-label={labels.filters.all}
        className="relative mx-auto flex max-w-full items-center justify-center gap-x-4 overflow-x-auto px-1 pb-1.5 [-ms-overflow-style:none] [scrollbar-width:none] sm:gap-x-7 [&::-webkit-scrollbar]:hidden"
      >
        {filterIndicator ? (
          <span
            aria-hidden
            className="friends-filter-indicator pointer-events-none absolute bottom-0 h-0.5 rounded-full"
            style={{ left: filterIndicator.left, width: filterIndicator.width }}
          />
        ) : null}
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
              role="tab"
              aria-selected={active}
              data-active={active || undefined}
              onClick={() => setFilter(id)}
              className={`relative z-[1] shrink-0 px-0.5 py-1 text-[11px] font-semibold tracking-[0.12em] uppercase transition-colors ${
                active
                  ? "text-white"
                  : "text-on-surface-variant/75 hover:text-white/90"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {labels.filters[id]}
                {badge && badge > 0 ? (
                  <span className="rounded-md bg-pokeball-red/90 px-1.5 py-px text-[9px] font-bold normal-case tracking-normal tabular-nums text-white">
                    {badge}
                  </span>
                ) : null}
              </span>
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
        <div className="friends-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
        <TrainerAvatar name={hit.username} src={src} size="sm" />
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
  const stageSrc = avatarStageSrc(friend.avatarId);
  const favAccent = friend.favorite
    ? typeColor(friend.favorite.types[0] ?? "normal")
    : "rgba(255,106,0,0.28)";
  const companionUrl = friend.favorite
    ? uiSpriteUrl(friend.favorite.spriteUrl, friend.favorite.isShiny)
    : null;
  const rankLabel = labels.card.ranks[friend.rankTierId] ?? friend.rankTierId;
  const mainType = friend.favorite?.types[0]?.toLowerCase() ?? null;
  const fallback = RANK_RAIL_FALLBACK[friend.rankTierId] ?? RANK_RAIL_FALLBACK.bronze;
  const railPlate = railFluorForType(mainType) ?? fallback.plate;
  const railInk = mainType
    ? RAIL_LIGHT_INK_TYPES.has(mainType)
      ? "#f4f1ec"
      : "#1a1410"
    : fallback.ink;
  const isOffline = friend.presence === "offline";

  return (
    <article
      className="friends-card group relative flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/95"
      data-presence={friend.presence}
      style={
        {
          ...style,
          ["--friends-rail" as string]: railPlate,
          ["--friends-rail-ink" as string]: railInk,
        } as CSSProperties
      }
    >
      <aside className="friends-card__rail max-sm:hidden" aria-hidden>
        <span className="friends-card__rail-code">
          <span className="friends-card__rail-code-lv">{friend.level}</span>
        </span>
        <span className="friends-card__rail-name">{friend.username}</span>
      </aside>

      <div className="friends-card__body relative z-[1] flex min-w-0 flex-col text-left">
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full min-w-0 flex-col text-left"
        >
        {/*
          Banner: stage completo. Mobile = ancho total + altura fija para
          no cortar el avatar. sm+ = franja landscape sobre la meta.
        */}
        <span className="friends-card__banner relative isolate block h-[8.25rem] w-full shrink-0 overflow-hidden sm:h-[10.75rem] lg:h-[11.5rem]">
          <span
            aria-hidden
            className="absolute inset-0"
            style={{
              background: `
                radial-gradient(70% 55% at 50% 100%, ${favAccent}40 0%, transparent 62%),
                linear-gradient(180deg, #141820 0%, #0a0c11 100%)
              `,
            }}
          />
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-10 sm:h-12"
            style={{
              background: `radial-gradient(55% 100% at 50% 100%, ${favAccent}33 0%, transparent 70%)`,
            }}
          />

          <span className="absolute inset-x-0 bottom-1.5 flex items-end justify-center gap-0 px-2 sm:bottom-1.5 sm:px-2">
            {companionUrl ? (
              <span className="relative z-0 -mr-4 mb-0.5 flex shrink-0 items-end sm:-mr-4">
                <span
                  aria-hidden
                  className="absolute inset-x-1 bottom-0 mx-auto h-2 w-[65%] rounded-[100%] bg-black/50 blur-[2px]"
                />
                <Image
                  src={companionUrl}
                  alt={friend.favorite?.name ?? ""}
                  width={160}
                  height={160}
                  className="relative max-h-[5.5rem] w-auto max-w-[4.75rem] object-contain drop-shadow-[0_8px_12px_rgba(0,0,0,0.5)] sm:max-h-[6rem] sm:max-w-[5rem]"
                  unoptimized
                />
              </span>
            ) : null}

            <span className="relative z-[1] flex shrink-0 items-end">
              <span
                aria-hidden
                className="absolute inset-x-2 bottom-0 mx-auto h-2 w-[58%] rounded-[100%] bg-black/50 blur-[2px]"
              />
              {stageSrc ? (
                <Image
                  src={stageSrc}
                  alt={friend.username}
                  width={200}
                  height={280}
                  className="relative max-h-[6.75rem] w-auto max-w-[5.5rem] object-contain object-bottom drop-shadow-[0_8px_12px_rgba(0,0,0,0.55)] sm:max-h-[8.25rem] sm:max-w-[6.25rem]"
                  unoptimized
                />
              ) : (
                <span className="mb-1 flex h-[5.5rem] w-14 items-end justify-center rounded-xl bg-white/5 sm:h-[6.5rem] sm:w-[4.5rem]">
                  <span className="material-symbols-outlined mb-2 text-[32px]! text-white/35 sm:mb-2.5 sm:text-[38px]!">
                    person
                  </span>
                </span>
              )}
            </span>
          </span>

          {friend.isFavorite ? (
            <span className="absolute left-2 top-2 z-[2] material-symbols-outlined text-tertiary text-[16px]! drop-shadow">
              star
            </span>
          ) : null}

          {friend.favorite ? (
            <span className="absolute bottom-1.5 left-2 z-[2] max-w-[55%] truncate rounded-md bg-black/45 px-1.5 py-0.5 text-[9px] font-medium capitalize tracking-wide text-white/80 backdrop-blur-[2px]">
              {friend.favorite.name}
            </span>
          ) : null}

          {/* Accent de tipo en mobile (sin rail vertical). */}
          <span
            aria-hidden
            className="absolute inset-y-0 right-0 w-1 sm:hidden"
            style={{ background: railPlate }}
          />
        </span>
        </button>

        <div className="flex min-w-0 flex-col gap-1 border-t border-white/8 bg-[#0e1118]/85 px-3 py-2">
          <button type="button" onClick={onOpen} className="flex w-full min-w-0 flex-col gap-1 text-left">
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="truncate text-[14px] font-semibold tracking-tight text-white sm:text-[13px]">
                {friend.username}
              </span>
              <FlagIcon code={friend.country} className="h-3 w-4 shrink-0" />
              <span className="ml-auto shrink-0 tabular-nums text-[11px] font-semibold text-white/55 sm:hidden">
                {friend.level}
              </span>
            </span>

            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[10px] text-on-surface-variant">
              <span className="truncate">
                {labels.card.titles[friend.titleId] ?? friend.titleId}
              </span>
              <span className="opacity-35">·</span>
              <span className="shrink-0 rounded-full border border-white/12 bg-white/[0.06] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-white/80">
                {rankLabel}
              </span>
            </span>

            {friend.regionLabel ? (
              <span className="hidden truncate text-[10px] text-on-surface-variant/85 sm:block">
                {friend.regionLabel}
              </span>
            ) : null}
          </button>

          <span className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={onOpen}
              className="flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5 overflow-hidden text-left"
            >
              <PresenceBadge
                status={friend.presence}
                label={labels.presence[friend.presence]}
              />
              {isOffline ? (
                <span className="truncate text-[9px] text-on-surface-variant/60">
                  {labels.lastSeen} {relativeTime(friend.lastSeenAt, labels)}
                </span>
              ) : null}
            </button>

            <span className="flex shrink-0 items-center gap-0.5 sm:hidden">
              <ActionIcon label={labels.actions.profile} icon="badge" onClick={onOpen} compact />
              <ActionIcon
                label={friend.isFavorite ? labels.actions.unfavorite : labels.actions.favorite}
                icon={friend.isFavorite ? "star" : "star_outline"}
                onClick={onFavorite}
                compact
              />
              <ActionIcon
                label={labels.actions.remove}
                icon="person_remove"
                onClick={onRemove}
                danger
                compact
              />
            </span>
          </span>
        </div>
      </div>

      <div className="friends-actions absolute bottom-0 z-[2] hidden translate-y-full items-center justify-center gap-1 border-t border-white/10 bg-[#0b0d13]/95 px-1.5 py-2 opacity-0 backdrop-blur-md transition duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100 sm:flex">
        <ActionIcon label={labels.actions.profile} icon="badge" onClick={onOpen} />
        <ActionIcon
          label={friend.isFavorite ? labels.actions.unfavorite : labels.actions.favorite}
          icon={friend.isFavorite ? "star" : "star_outline"}
          onClick={onFavorite}
        />
        <ActionIcon label={labels.actions.invite} icon="swords" disabled title={labels.comingSoon} />
        <ActionIcon label={labels.actions.trade} icon="sync_alt" disabled title={labels.comingSoon} />
        <ActionIcon
          label={labels.actions.gift}
          icon="featured_seasonal_and_gifts"
          disabled
          title={labels.comingSoon}
        />
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
  className = "",
  compact = false,
}: {
  label: string;
  icon: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  title?: string;
  className?: string;
  compact?: boolean;
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
      className={`flex items-center justify-center rounded-lg border border-white/10 transition disabled:cursor-not-allowed disabled:opacity-35 ${
        compact ? "h-7 w-7" : "h-8 w-8"
      } ${
        danger
          ? "text-pokeball-red hover:bg-pokeball-red/15"
          : "text-white/80 hover:bg-white/10 hover:text-white"
      } ${className}`}
    >
      <span className={`material-symbols-outlined ${compact ? "text-[16px]!" : "text-[18px]!"}`}>
        {icon}
      </span>
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
              <TrainerAvatar name={r.username} src={src} size="md" />
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
            <TrainerAvatar name={b.username} src={src} size="md" className="opacity-60" />
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
              ? `radial-gradient(55% 50% at 18% 30%, ${fav.accent}33 0%, transparent 60%), radial-gradient(40% 40% at 85% 10%, rgba(255,106,0,0.14) 0%, transparent 50%)`
              : "radial-gradient(40% 40% at 85% 10%, rgba(255,106,0,0.12) 0%, transparent 50%)",
          }}
        />

        <div className="relative z-[1] flex items-center justify-between border-b border-white/8 px-4 py-3 sm:px-6">
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[#ff6a00]">
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
              <TrainerAvatar
                name={card.username}
                src={src}
                size="xl"
                presenceClassName={PRESENCE_META[card.presence].dot}
              />
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
