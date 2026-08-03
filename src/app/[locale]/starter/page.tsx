import { getTranslations } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { STARTER_SPECIES_IDS } from "@/lib/starters";
import { StarterHub } from "@/components/starter/starter-hub";

export default async function StarterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale });
    return null;
  }

  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true },
  });
  if (!account) {
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
    select: {
      id: true,
      name: true,
      spriteUrl: true,
      types: true,
    },
  });

  return (
    <div className="flex-1 px-margin-mobile py-8 md:px-margin-desktop">
      <StarterHub starters={starters} locale={locale} />
    </div>
  );
}
