import { getTranslations } from "next-intl/server";
import { PokeballLoader } from "@/components/pokeball-loader";

export default async function Loading() {
  const t = await getTranslations("loading");
  return <PokeballLoader label={t("syncing")} />;
}
