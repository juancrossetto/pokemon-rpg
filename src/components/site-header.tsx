import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { auth, signOut } from "@/auth";

export async function SiteHeader() {
  const [t, session] = await Promise.all([getTranslations("nav"), auth()]);

  return (
    <>
      {/* TopAppBar (desktop) */}
      <nav className="fixed top-0 w-full z-50 hidden md:flex justify-between items-center px-6 py-2 bg-background/95 backdrop-blur-xl border-b border-white/10 shadow-2xl">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="text-headline-lg font-black text-pokeball-red tracking-tighter"
          >
            {t("brand")}
          </Link>
          <div className="flex gap-2 ml-6">
            <Link
              href="/pokedex"
              className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
            >
              {t("pokedex")}
            </Link>
            {session?.user && (
              <>
                <Link
                  href="/team"
                  className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                >
                  {t("team")}
                </Link>
                <Link
                  href="/battle"
                  className="text-on-surface-variant hover:text-on-surface transition-colors text-label-md px-2 py-1"
                >
                  {t("battle")}
                </Link>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex gap-1 text-label-sm">
            {routing.locales.map((locale) => (
              <Link
                key={locale}
                href="/"
                locale={locale}
                className="uppercase px-1 text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {locale}
              </Link>
            ))}
          </div>

          {session?.user ? (
            <div className="flex items-center gap-2 pl-4 border-l border-white/10">
              <span className="text-label-md text-on-surface">{session.user.name}</span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="text-label-sm text-on-surface-variant hover:text-pokeball-red transition-colors"
                >
                  {t("logout")}
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-2 pl-4 border-l border-white/10">
              <Link
                href="/login"
                className="text-label-md text-on-surface-variant hover:text-on-surface transition-colors"
              >
                {t("login")}
              </Link>
              <Link
                href="/register"
                className="text-label-md rounded-lg bg-pokeball-red px-4 py-1 text-white hover:bg-pokeball-red/80 transition-colors"
              >
                {t("register")}
              </Link>
            </div>
          )}
        </div>
      </nav>

      {/* BottomNavBar (mobile) */}
      <nav className="fixed bottom-0 w-full z-50 flex md:hidden justify-around items-center px-4 h-16 bg-background/98 backdrop-blur-xl border-t border-white/10 shadow-2xl">
        <Link
          href="/"
          className="flex flex-col items-center justify-center text-pokeball-red px-4 py-1 text-label-sm"
        >
          <span className="material-symbols-outlined">dashboard</span>
          {t("home")}
        </Link>
        <Link
          href="/pokedex"
          className="flex flex-col items-center justify-center text-on-surface-variant hover:text-pokeball-red transition-colors px-4 py-1 text-label-sm"
        >
          <span className="material-symbols-outlined">auto_stories</span>
          {t("pokedex")}
        </Link>
        {session?.user && (
          <>
            <Link
              href="/team"
              className="flex flex-col items-center justify-center text-on-surface-variant hover:text-pokeball-red transition-colors px-4 py-1 text-label-sm"
            >
              <span className="material-symbols-outlined">group</span>
              {t("team")}
            </Link>
            <Link
              href="/battle"
              className="flex flex-col items-center justify-center text-on-surface-variant hover:text-pokeball-red transition-colors px-4 py-1 text-label-sm"
            >
              <span className="material-symbols-outlined">swords</span>
              {t("battle")}
            </Link>
          </>
        )}
      </nav>
    </>
  );
}
