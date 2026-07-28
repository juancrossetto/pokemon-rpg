import { redirect } from "@/i18n/navigation";

/** La tienda oficial vive en el hub de Comercio: `/market?tab=shop`. */
export default async function ShopPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect({ href: "/market?tab=shop", locale });
  return null;
}
