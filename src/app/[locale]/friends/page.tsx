import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { loadFriendsHub } from "@/lib/friends-data";
import { FriendsHub, type FriendsLabels } from "@/components/friends/friends-hub";

export default async function FriendsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ filter?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, tNav, session] = await Promise.all([
    getTranslations("friends"),
    getTranslations("nav"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const snapshot = await loadFriendsHub(session.user.id);

  const filterRaw = query.filter;
  const initialFilter =
    filterRaw === "favorites" ||
    filterRaw === "requests" ||
    filterRaw === "blocked" ||
    filterRaw === "all"
      ? filterRaw
      : "all";

  const labels: FriendsLabels = {
    community: tNav("groups.community"),
    eyebrow: t("eyebrow"),
    title: t("title"),
    subtitle: t("subtitle"),
    friendsCount: t("stats.friends"),
    onlineCount: t("stats.online"),
    requestsCount: t("stats.requests"),
    searchPlaceholder: t("search.placeholder"),
    searchHint: t("search.hint"),
    searching: t("search.searching"),
    noResults: t("search.noResults"),
    addFriend: t("addFriend"),
    requestSent: t("requestSent"),
    accept: t("accept"),
    decline: t("decline"),
    cancelRequest: t("cancelRequest"),
    filters: {
      all: t("filters.all"),
      online: t("filters.online"),
      favorites: t("filters.favorites"),
      recent: t("filters.recent"),
      requests: t("filters.requests"),
      blocked: t("filters.blocked"),
    },
    presence: {
      online: t("presence.online"),
      away: t("presence.away"),
      fighting: t("presence.fighting"),
      gym: t("presence.gym"),
      exploring: t("presence.exploring"),
      offline: t("presence.offline"),
    },
    level: t("level"),
    badges: t("badges"),
    emptyFriends: t("empty.friends"),
    emptyFriendsHint: t("empty.friendsHint"),
    emptyFilter: t("empty.filter"),
    emptyRequests: t("empty.requests"),
    emptyBlocked: t("empty.blocked"),
    lastSeen: t("lastSeen"),
    justNow: t("time.justNow"),
    minutesAgo: t.raw("time.minutesAgo") as string,
    hoursAgo: t.raw("time.hoursAgo") as string,
    daysAgo: t.raw("time.daysAgo") as string,
    neverSeen: t("time.never"),
    actions: {
      profile: t("actions.profile"),
      favorite: t("actions.favorite"),
      unfavorite: t("actions.unfavorite"),
      invite: t("actions.invite"),
      message: t("actions.message"),
      trade: t("actions.trade"),
      gift: t("actions.gift"),
      compare: t("actions.compare"),
      remove: t("actions.remove"),
      block: t("actions.block"),
      unblock: t("actions.unblock"),
    },
    comingSoon: t("comingSoon"),
    card: {
      trainerCard: t("card.trainerCard"),
      metrics: t("card.metrics"),
      pokedex: t("card.pokedex"),
      gyms: t("card.gyms"),
      pvp: t("card.pvp"),
      power: t("card.power"),
      hours: t("card.hours"),
      hoursSoon: t("card.hoursSoon"),
      squad: t("card.squad"),
      activity: t("card.activity"),
      noActivity: t("card.noActivity"),
      noFavorite: t("card.noFavorite"),
      noSquad: t("card.noSquad"),
      memberSince: t("card.memberSince"),
      close: t("card.close"),
      favorite: t("card.favorite"),
      cp: t("card.cp"),
      rarity: {
        common: t("card.rarity.common"),
        rare: t("card.rarity.rare"),
        epic: t("card.rarity.epic"),
        legendary: t("card.rarity.legendary"),
        mythical: t("card.rarity.mythical"),
        ultraBeast: t("card.rarity.ultraBeast"),
        paradox: t("card.rarity.paradox"),
      },
      titles: {
        rookie: t("card.titles.rookie"),
        trainer: t("card.titles.trainer"),
        collector: t("card.titles.collector"),
        gymLeaderBane: t("card.titles.gymLeaderBane"),
        researcher: t("card.titles.researcher"),
        duelist: t("card.titles.duelist"),
        legendTamer: t("card.titles.legendTamer"),
        shinyHunter: t("card.titles.shinyHunter"),
        mythKeeper: t("card.titles.mythKeeper"),
        champion: t("card.titles.champion"),
      },
      ranks: {
        bronze: t("card.ranks.bronze"),
        silver: t("card.ranks.silver"),
        gold: t("card.ranks.gold"),
        diamond: t("card.ranks.diamond"),
        master: t("card.ranks.master"),
        champion: t("card.ranks.champion"),
      },
      activityCatch: t("card.activityCatch"),
      activityBadge: t("card.activityBadge"),
      activityTrainer: t("card.activityTrainer"),
    },
    errors: {
      unauthorized: t("errors.unauthorized"),
      not_found: t("errors.not_found"),
      invalid: t("errors.invalid"),
      rate_limited: t("errors.rate_limited"),
      blocked: t("errors.blocked"),
      already_friends: t("errors.already_friends"),
      already_sent: t("errors.already_sent"),
      friends_full: t("errors.friends_full"),
      requests_full: t("errors.requests_full"),
    },
    confirmRemove: t("confirmRemove"),
    confirmBlock: t("confirmBlock"),
    toastSentTitle: t("toast.sentTitle"),
    toastSentDetail: t("toast.sentDetail"),
    toastAcceptedTitle: t("toast.acceptedTitle"),
    toastAcceptedDetail: t("toast.acceptedDetail"),
  };

  return (
    <FriendsHub
      locale={locale}
      initial={snapshot}
      labels={labels}
      initialFilter={initialFilter}
    />
  );
}
