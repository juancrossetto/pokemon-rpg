import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp } from "@/lib/stats";
import { redirectIfInBattle } from "@/lib/battle-lock";
import { getLocale } from "next-intl/server";

const TEAM_SIZE = 6;

export default async function Home() {
  const [t, session, locale] = await Promise.all([
    getTranslations("home"),
    auth(),
    getLocale(),
  ]);

  if (session?.user) {
    await redirectIfInBattle(session.user.id, locale);
    return <Dashboard username={session.user.name ?? ""} userId={session.user.id} />;
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile md:px-margin-desktop py-8 text-center">
      <p className="text-label-md text-pokeball-red uppercase tracking-widest flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-pokeball-red animate-pulse" />
        {t("eyebrow")}
      </p>
      <h1 className="max-w-2xl text-headline-lg md:text-display-lg text-white tracking-tight">
        {t("title")}
      </h1>
      <p className="max-w-md text-body-lg text-on-surface-variant">{t("subtitle")}</p>

      <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
        <Link
          href="/pokedex"
          className="rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
        >
          {t("pokedexLink")}
        </Link>
        <Link
          href="/register"
          className="glass-panel rounded-lg px-6 py-2 text-label-md text-on-surface hover:bg-white/5 transition-colors"
        >
          {t("register")}
        </Link>
      </div>
    </div>
  );
}

async function Dashboard({ username, userId }: { username: string; userId: string }) {
  const t = await getTranslations("home");

  const pokemon = await prisma.pokemonInstance.findMany({
    where: { ownerId: userId, teamSlot: { not: null } },
    include: { species: true },
    orderBy: { teamSlot: "asc" },
  });

  if (pokemon.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-margin-mobile py-8 text-center">
        <p className="text-label-md text-pokeball-red uppercase tracking-widest">
          {t("greeting", { username })}
        </p>
        <h1 className="max-w-xl text-headline-lg md:text-display-lg text-white">
          {t("noTeamTitle")}
        </h1>
        <p className="max-w-md text-body-lg text-on-surface-variant">{t("noTeamSubtitle")}</p>
        <Link
          href="/starter"
          className="mt-2 rounded-lg bg-pokeball-red px-6 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors"
        >
          {t("chooseStarterLink")}
        </Link>
      </div>
    );
  }

  const bySlot = new Map(pokemon.map((p) => [p.teamSlot, p]));
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => bySlot.get(i + 1) ?? null);

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-label-md text-pokeball-red uppercase tracking-widest flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-pokeball-red animate-pulse" />
          {t("eyebrow")}
        </p>
        <h1 className="mt-1 text-headline-lg md:text-display-lg text-white">
          {t("greeting", { username })}
        </h1>

        <section className="glass-panel rounded-xl mt-6 p-4 border border-white/10 shadow-lg">
          <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-pokeball-red">group</span>
              <h2 className="text-headline-md text-white">{t("activeSquad")}</h2>
            </div>
            <Link
              href="/team"
              className="text-label-sm text-on-surface-variant hover:text-white transition-colors flex items-center gap-1"
            >
              {t("manage")}
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
            {slots.map((instance, i) =>
              instance ? (
                <SquadPreviewCard
                  key={instance.id}
                  nickname={instance.nickname}
                  speciesName={instance.species.name}
                  level={instance.level}
                  types={instance.species.types}
                  spriteUrl={instance.species.spriteUrl}
                  currentHp={instance.currentHp}
                  maxHp={calculateMaxHp(instance.species.baseHp, instance.level)}
                />
              ) : (
                <Link
                  key={`empty-${i}`}
                  href="/team"
                  className="bg-surface-container-low/30 border border-white/10 border-dashed rounded-lg p-2 flex flex-col items-center justify-center min-h-[140px] hover:bg-white/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-on-surface-variant/40 text-3xl mb-2">
                    add
                  </span>
                  <span className="text-label-sm text-on-surface-variant/40">
                    {t("emptySlot")}
                  </span>
                </Link>
              ),
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SquadPreviewCard({
  nickname,
  speciesName,
  level,
  types,
  spriteUrl,
  currentHp,
  maxHp,
}: {
  nickname: string | null;
  speciesName: string;
  level: number;
  types: string[];
  spriteUrl: string;
  currentHp: number;
  maxHp: number;
}) {
  const hpPct = Math.max(0, Math.min(100, (currentHp / maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";

  return (
    <Link
      href="/team"
      className="bg-surface-container-high/40 border border-white/10 rounded-lg p-2 relative hover:bg-white/10 transition-all group shadow-sm"
    >
      <div className="absolute top-2 right-2 flex gap-1">
        {types.map((type) => (
          <span
            key={type}
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: typeColor(type) }}
          />
        ))}
      </div>
      <div className="w-16 h-16 mx-auto mb-2 rounded-full bg-black/60 border border-white/20 flex items-center justify-center overflow-hidden">
        {spriteUrl && (
          <Image
            src={spriteUrl}
            alt={speciesName}
            width={64}
            height={64}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          />
        )}
      </div>
      <div className="text-center">
        <p className="text-label-md text-on-surface font-bold capitalize">
          {nickname ?? speciesName}
        </p>
        <p className="text-label-sm text-on-surface-variant">Lv. {level}</p>
      </div>
      <div className="mt-2">
        <div className="h-1.5 w-full bg-surface-container-highest rounded-full overflow-hidden">
          <div className={`h-full health-bar-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
        </div>
        <div className="flex justify-between text-label-sm mt-1 text-on-surface-variant text-[10px]">
          <span>HP</span>
          <span className="text-on-surface">
            {currentHp}/{maxHp}
          </span>
        </div>
      </div>
    </Link>
  );
}
