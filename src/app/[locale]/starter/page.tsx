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
    <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-var(--bottom-nav-h)-env(safe-area-inset-bottom,0px)-1.75rem)] max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-var(--bottom-nav-h)-env(safe-area-inset-bottom,0px)-1.75rem)] flex-col overflow-hidden px-margin-mobile py-3 md:px-margin-desktop sm:py-4 xl:h-[calc(100dvh-3.5rem)] xl:max-h-[calc(100dvh-3.5rem)]">
      <StarterHub starters={starters} locale={locale} />
    </div>
  );
}
