import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { redirectIfInBattle } from "@/lib/battle-lock";

export default async function PokedexPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([getTranslations("pokedex"), auth()]);
  if (session?.user) {
    await redirectIfInBattle(session.user.id, locale);
  }

  const species = await prisma.species.findMany({ orderBy: { id: "asc" } });

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-6">
      <div className="mx-auto max-w-6xl">
        <p className="text-label-md text-pokeball-red uppercase tracking-widest flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-pokeball-red" />
          {t("eyebrow")}
        </p>
        <h1 className="text-headline-lg md:text-display-lg text-white mt-1">{t("title")}</h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          {t("subtitle", { count: species.length })}
        </p>

        <ul className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {species.map((s) => (
            <li
              key={s.id}
              className="bg-glass-surface backdrop-blur-xl border border-white/10 rounded-xl p-2 flex flex-col items-center text-center hover:border-white/20 transition-colors"
            >
              <span className="self-start text-label-sm text-on-surface-variant/60">
                #{String(s.id).padStart(3, "0")}
              </span>
              {s.spriteUrl && (
                <Image
                  src={s.spriteUrl}
                  alt={s.name}
                  width={96}
                  height={96}
                  className="h-24 w-24 object-contain"
                />
              )}
              <p className="text-label-md text-on-surface font-bold capitalize">{s.name}</p>
              <div className="mt-1 flex flex-wrap justify-center gap-1">
                {s.types.map((type) => {
                  const color = typeColor(type);
                  return (
                    <span
                      key={type}
                      className="px-2 py-0.5 rounded text-label-sm border uppercase text-[10px]"
                      style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
                    >
                      {type}
                    </span>
                  );
                })}
              </div>
              <dl className="mt-2 grid w-full grid-cols-3 gap-x-1 gap-y-0.5 text-[10px] text-on-surface-variant border-t border-white/5 pt-1">
                <div>
                  <dt className="uppercase">{t("stats.hp")}</dt>
                  <dd className="text-label-sm font-semibold text-on-surface">{s.baseHp}</dd>
                </div>
                <div>
                  <dt className="uppercase">{t("stats.atk")}</dt>
                  <dd className="text-label-sm font-semibold text-on-surface">{s.baseAttack}</dd>
                </div>
                <div>
                  <dt className="uppercase">{t("stats.spd")}</dt>
                  <dd className="text-label-sm font-semibold text-on-surface">{s.baseSpeed}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
