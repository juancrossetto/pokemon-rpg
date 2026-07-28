import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/**
 * Tabs compartidas del comercio: Tienda (catálogo NPC) | Mercado (jugadores).
 * Las economías siguen separadas — esto sólo elimina el "¿en cuál estaba?"
 * al saltar entre las dos superficies de compra.
 */
export async function TradeTabs({ active }: { active: "shop" | "market" }) {
  const t = await getTranslations("nav");
  const entries = [
    { id: "shop" as const, href: "/market?tab=shop", icon: "local_mall", label: t("shop") },
    { id: "market" as const, href: "/market?tab=browse", icon: "storefront", label: t("market") },
  ];

  return (
    <div className="mb-5 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {entries.map((entry) => (
        <Link
          key={entry.id}
          href={entry.href}
          aria-current={active === entry.id ? "page" : undefined}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-label-sm font-semibold transition ${
            active === entry.id
              ? "bg-pokeball-red text-white shadow-[0_4px_14px_rgba(238,21,21,0.3)]"
              : "text-on-surface-variant hover:bg-white/[0.05] hover:text-on-surface"
          }`}
        >
          <span aria-hidden className="material-symbols-outlined text-[18px]!">
            {entry.icon}
          </span>
          {entry.label}
        </Link>
      ))}
    </div>
  );
}
