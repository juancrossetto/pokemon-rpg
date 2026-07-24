import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { calculateMaxHp } from "@/lib/stats";
import { PC_ERRORS, PC_NOTICES, pickCode } from "@/lib/feedback-codes";
import { TEAM_SIZE } from "@/lib/market-rules";
import { depositPokemon, withdrawPokemon } from "@/actions/pc";
import { redirectIfInBattle } from "@/lib/battle-lock";

export default async function PcPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const [t, session] = await Promise.all([getTranslations("pc"), auth()]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  await redirectIfInBattle(session.user.id, locale);

  // Lista blanca: los códigos llegan por querystring y sin validarlos
  // ?error=loquesea le muestra la clave de traducción cruda al jugador.
  const error = pickCode(query.error, PC_ERRORS);
  const notice = pickCode(query.notice, PC_NOTICES);

  const pokemon = await prisma.pokemonInstance.findMany({
    where: { ownerId: session.user.id },
    include: {
      species: true,
      listings: { where: { status: "ACTIVE" }, select: { id: true } },
    },
    orderBy: [{ teamSlot: { sort: "asc", nulls: "last" } }, { caughtAt: "asc" }],
  });

  if (pokemon.length === 0) {
    redirect({ href: "/starter", locale });
    return null;
  }

  const team = pokemon.filter((p) => p.teamSlot !== null);
  const stored = pokemon.filter((p) => p.teamSlot === null);
  const teamFull = team.length >= TEAM_SIZE;

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
          <p className="text-label-md text-on-surface-variant mt-1">{t("subtitle")}</p>
        </div>

        {notice && (
          <div className="mb-4 rounded-lg border border-tertiary/40 bg-tertiary/10 px-4 py-2 text-label-md text-tertiary">
            {t(`notices.${notice}`)}
          </div>
        )}
        {error && (
          <div className="mb-4 rounded-lg border border-error/40 bg-error-container/30 px-4 py-2 text-label-md text-error">
            {t(`errors.${error}`)}
          </div>
        )}

        <section className="mb-8">
          <h2 className="text-headline-md text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-pokeball-red text-[20px]">group</span>
            {t("teamSection", { count: team.length, max: TEAM_SIZE })}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {team.map((instance) => (
              <PokemonRow key={instance.id} instance={instance}>
                {team.length > 1 ? (
                  <form action={depositPokemon.bind(null, locale)}>
                    <input type="hidden" name="pokemonId" value={instance.id} />
                    <button
                      type="submit"
                      className="text-label-md px-3 py-1.5 rounded-lg border border-white/10 text-on-surface-variant hover:text-pokeball-red hover:border-pokeball-red/40 transition-colors shrink-0"
                    >
                      {t("deposit")}
                    </button>
                  </form>
                ) : (
                  <span className="text-label-sm text-on-surface-variant italic shrink-0">
                    {t("lastTeamMember")}
                  </span>
                )}
              </PokemonRow>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-headline-md text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-electric-yellow text-[20px]">storage</span>
            {t("storageSection", { count: stored.length })}
          </h2>
          {stored.length === 0 ? (
            <div className="bg-glass-surface border border-white/5 border-dashed rounded-xl p-8 flex flex-col items-center justify-center text-on-surface-variant">
              <span className="material-symbols-outlined text-[40px] mb-2 opacity-50">storage</span>
              <span className="text-label-md">{t("emptyStorage")}</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {stored.map((instance) => {
                const isListed = instance.listings.length > 0;
                return (
                  <PokemonRow key={instance.id} instance={instance}>
                    {isListed ? (
                      <span className="text-label-sm px-2 py-1 rounded bg-electric-yellow/10 border border-electric-yellow/30 text-electric-yellow shrink-0">
                        {t("listed")}
                      </span>
                    ) : teamFull ? (
                      <span className="text-label-sm text-on-surface-variant italic shrink-0">
                        {t("teamFull")}
                      </span>
                    ) : (
                      <form action={withdrawPokemon.bind(null, locale)}>
                        <input type="hidden" name="pokemonId" value={instance.id} />
                        <button
                          type="submit"
                          className="text-label-md px-3 py-1.5 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors shrink-0"
                        >
                          {t("withdraw")}
                        </button>
                      </form>
                    )}
                  </PokemonRow>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

async function PokemonRow({
  instance,
  children,
}: {
  instance: {
    id: string;
    nickname: string | null;
    level: number;
    currentHp: number;
    ptConstitution: number;
    species: { name: string; spriteUrl: string; types: string[]; baseHp: number };
  };
  children: React.ReactNode;
}) {
  const t = await getTranslations("pc");
  const maxHp = calculateMaxHp(instance.species.baseHp, instance.level, instance.ptConstitution);
  const hpPct = Math.max(0, Math.min(100, (instance.currentHp / maxHp) * 100));
  const hpClass = hpPct > 50 ? "" : hpPct > 20 ? "yellow" : "red";

  return (
    <article className="bg-glass-surface backdrop-blur-xl border border-white/10 rounded-xl p-3 flex items-center gap-3">
      <div className="w-12 h-12 rounded-full bg-surface-container-high border-2 border-surface-variant flex items-center justify-center overflow-hidden shrink-0">
        <Image
          src={instance.species.spriteUrl}
          alt={instance.species.name}
          width={48}
          height={48}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="text-label-md text-on-surface capitalize truncate">
            {instance.nickname ?? instance.species.name}
          </span>
          <span className="text-label-sm text-on-surface-variant shrink-0">
            {t("level", { level: instance.level })}
          </span>
        </div>
        <div className="flex items-center gap-1 mt-1">
          {instance.species.types.map((type) => {
            const color = typeColor(type);
            return (
              <span
                key={type}
                className="px-1.5 py-0.5 rounded text-[10px] uppercase border"
                style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
              >
                {type}
              </span>
            );
          })}
        </div>
        <div className="mt-1.5 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
          <div className={`h-full health-bar-fill ${hpClass}`} style={{ width: `${hpPct}%` }} />
        </div>
      </div>
      {children}
    </article>
  );
}
