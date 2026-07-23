import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { typeColor } from "@/lib/type-colors";
import { STARTER_SPECIES_IDS } from "@/lib/starters";
import { chooseStarter } from "@/actions/choose-starter";

export default async function StarterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const [t, session] = await Promise.all([
    getTranslations("starter"),
    auth(),
  ]);

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const existingTeam = await prisma.pokemonInstance.findFirst({
    where: { ownerId: session.user.id },
  });
  if (existingTeam) {
    redirect({ href: "/team", locale });
    return null;
  }

  const starters = await prisma.species.findMany({
    where: { id: { in: [...STARTER_SPECIES_IDS] } },
    orderBy: { id: "asc" },
  });

  return (
    <div className="flex-1 px-margin-mobile md:px-margin-desktop py-8">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="text-headline-lg md:text-display-lg text-white">{t("title")}</h1>
        <p className="mt-1 text-body-lg text-on-surface-variant">{t("subtitle")}</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {starters.map((species) => (
            <form key={species.id} action={chooseStarter.bind(null, species.id, locale)}>
              <button
                type="submit"
                className="flex w-full flex-col items-center bg-glass-surface backdrop-blur-xl border border-white/10 rounded-xl p-6 transition hover:border-pokeball-red/50 hover:shadow-[0_0_30px_rgba(238,21,21,0.15)]"
              >
                {species.spriteUrl && (
                  <Image
                    src={species.spriteUrl}
                    alt={species.name}
                    width={128}
                    height={128}
                    className="h-32 w-32 object-contain"
                  />
                )}
                <p className="mt-1 text-headline-md text-on-surface capitalize">
                  {species.name}
                </p>
                <div className="mt-1 flex gap-1">
                  {species.types.map((type) => {
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
                <span className="mt-4 rounded-lg bg-pokeball-red px-4 py-1 text-label-md text-white">
                  {t("choose")}
                </span>
              </button>
            </form>
          ))}
        </div>
      </div>
    </div>
  );
}
