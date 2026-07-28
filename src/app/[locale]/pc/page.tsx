import { redirect } from "@/i18n/navigation";

/**
 * El PC vive dentro del hub de Pokémon (/team?tab=pc). Esta ruta queda como
 * redirect porque hay server actions y links viejos que apuntan a /pc con
 * códigos de error/notice en el querystring — se preservan.
 */
export default async function PcPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const extra = new URLSearchParams({ tab: "pc" });
  if (query.error) extra.set("error", query.error);
  if (query.notice) extra.set("notice", query.notice);
  redirect({ href: `/team?${extra.toString()}`, locale });
}
