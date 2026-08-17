"use client";

import { useMemo, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { registerUser } from "@/actions/register";
import { CountrySelect } from "@/components/country-select";
import { AvatarImage } from "@/components/avatar-image";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BrandLogo } from "@/components/brand-logo";
import { AuthBackdrop } from "@/components/auth-backdrop";
import { LegalDisclaimer } from "@/components/legal-disclaimer";
import { avatarById } from "@/lib/avatars";
import { starterAvatarOptions } from "@/lib/avatar-unlocks";
import { markBootSplashPending } from "@/lib/boot-splash";
import { writeFriendsRailVisible } from "@/lib/friends-rail-pref";

type Gender = "male" | "female" | "unspecified";

const GENDER_OPTIONS: {
  value: Gender;
  icon: string;
  labelKey: "genderMale" | "genderFemale" | "genderUnspecified";
  shortKey: "genderMaleShort" | "genderFemaleShort" | "genderUnspecifiedShort";
}[] = [
  { value: "male", icon: "male", labelKey: "genderMale", shortKey: "genderMaleShort" },
  { value: "female", icon: "female", labelKey: "genderFemale", shortKey: "genderFemaleShort" },
  {
    value: "unspecified",
    icon: "question_mark",
    labelKey: "genderUnspecified",
    shortKey: "genderUnspecifiedShort",
  },
];

const FIELD =
  "auth-field w-full rounded-lg border border-white/8 bg-white/[0.035] py-2.5 pl-10 pr-3 text-[15px] text-white outline-none transition placeholder:text-white/30 focus:border-[color-mix(in_srgb,var(--theme-primary)_45%,transparent)] focus:bg-white/[0.055] focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--theme-primary)_14%,transparent)] sm:py-3";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const tNav = useTranslations("nav");
  const tLogin = useTranslations("auth.login");
  const locale = useLocale() as "es" | "en" | "pt";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [country, setCountry] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const selectedAvatar = useMemo(() => avatarById(avatarId), [avatarId]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    const result = await registerUser({
      email,
      username,
      password,
      country,
      locale,
      gender,
      age: null,
      avatarId,
    });

    if (!result.success) {
      setError(result.error);
      setStatus("idle");
      return;
    }

    setStatus("success");
    await signIn("credentials", {
      email,
      password,
      remember: "true",
      redirect: false,
    });
    markBootSplashPending();
    writeFriendsRailVisible(true);
    router.push("/starter");
    router.refresh();
  }

  const preview = (
    <div className="relative mx-auto flex w-full max-w-[9.5rem] items-end justify-center overflow-hidden rounded-xl border border-white/8 bg-linear-to-b from-white/5 to-black/40 px-3 py-3 lg:max-w-[11rem]">
      <div className="relative flex h-28 w-full items-end justify-center sm:h-32 lg:h-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 bottom-0 h-1/2 rounded-full bg-[color-mix(in_srgb,var(--theme-primary)_12%,transparent)] blur-2xl"
        />
        {selectedAvatar ? (
          <AvatarImage
            src={selectedAvatar.profileSrc}
            alt={selectedAvatar.id}
            className="relative z-10 h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
          />
        ) : (
          <span className="material-symbols-outlined relative z-10 text-[40px]! text-white/28 lg:text-[48px]!">
            person
          </span>
        )}
      </div>
    </div>
  );

  return (
    /* Alto = viewport − header. Sin overflow del documento: el scroll vive
       solo en la grilla de avatares. */
    <div className="relative isolate flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col overflow-hidden xl:h-[calc(100dvh-3.5rem)] xl:max-h-[calc(100dvh-3.5rem)]">
      <AuthBackdrop />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 py-1.5 sm:px-5 sm:py-2">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex h-full min-h-0 w-full max-w-[420px] flex-col lg:max-w-[860px]"
        >
          <div className="auth-login-panel relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-6 top-0 z-10 h-px bg-linear-to-r from-transparent via-[color-mix(in_srgb,var(--theme-primary)_55%,transparent)] to-transparent"
            />

            {/*
              Mobile: fila auto (logo) + resto 1fr (formulario).
              Desktop: dos columnas; la fila 1fr ya no aplica.
            */}
            <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] lg:grid-rows-none lg:items-stretch">
              <aside className="flex shrink-0 flex-col justify-center gap-2.5 border-b border-white/8 px-4 py-2.5 lg:border-b-0 lg:border-r lg:border-white/8 lg:px-5 lg:py-5">
                <div className="shrink-0 text-center">
                  <BrandLogo
                    alt={tNav("brand")}
                    priority
                    sizes="140px"
                    className="mx-auto h-auto w-[100px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:w-[120px] lg:w-[130px]"
                  />
                  <p className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.28em] text-white/38">
                    {tLogin("tagline")}
                  </p>
                </div>
                {/* Preview vacío solo en desktop; en mobile aparece al elegir avatar. */}
                <div className={selectedAvatar ? "block" : "hidden lg:block"}>
                  {preview}
                </div>
              </aside>

              <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                <header className="shrink-0 border-b border-white/6 px-4 py-2 sm:px-5 sm:py-2.5">
                  <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.22em] text-[color-mix(in_srgb,var(--theme-primary-bright)_88%,white)]">
                    {t("eyebrow")}
                  </p>
                  <h1 className="page-title text-[clamp(1.15rem,3.8vw,1.45rem)] tracking-[0.02em] text-white">
                    {t("title")}
                  </h1>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/48">
                    {t("subtitle")}
                  </p>
                </header>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-2 sm:gap-2.5 sm:px-5 sm:py-2.5">
                  <label className="block shrink-0">
                    <span className="sr-only">{t("username")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px]! text-white/35">
                        badge
                      </span>
                      <input
                        required
                        minLength={3}
                        maxLength={20}
                        autoComplete="username"
                        placeholder={t("username")}
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className={FIELD}
                      />
                    </div>
                  </label>

                  <label className="block shrink-0">
                    <span className="sr-only">{t("email")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px]! text-white/35">
                        mail
                      </span>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder={t("email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={FIELD}
                      />
                    </div>
                  </label>

                  <label className="block shrink-0">
                    <span className="sr-only">{t("password")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[17px]! text-white/35">
                        lock
                      </span>
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        minLength={8}
                        autoComplete="new-password"
                        placeholder={t("password")}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={`${FIELD} pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? tLogin("hidePassword") : tLogin("showPassword")
                        }
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-white/35 transition hover:bg-white/6 hover:text-white/75"
                      >
                        <span className="material-symbols-outlined text-[17px]!">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    <p className="mt-1 px-0.5 text-[11px] text-white/38">{t("passwordHint")}</p>
                  </label>

                  <div className="shrink-0">
                    <CountrySelect
                      compact
                      label={t("country")}
                      required
                      value={country}
                      onChange={setCountry}
                      locale={locale}
                      placeholder={t("countryPlaceholder")}
                    />
                  </div>

                  <div className="shrink-0">
                    <p className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                      {t("gender")}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {GENDER_OPTIONS.map((opt) => {
                        const label = t(opt.labelKey);
                        const shortLabel = t(opt.shortKey);
                        const selected = gender === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            aria-label={label}
                            aria-pressed={selected}
                            title={label}
                            onClick={() => setGender(selected ? null : opt.value)}
                            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-lg border px-1 py-1.5 transition ${
                              selected
                                ? "border-[color-mix(in_srgb,var(--theme-primary)_50%,transparent)] bg-[color-mix(in_srgb,var(--theme-primary)_18%,transparent)] text-[color-mix(in_srgb,var(--theme-primary-bright)_90%,white)]"
                                : "border-white/8 bg-white/[0.03] text-white/55 hover:border-white/18 hover:text-white/78"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[22px]! leading-none sm:text-[24px]!">
                              {opt.icon}
                            </span>
                            <span className="max-w-full truncate text-[10px] font-semibold leading-tight tracking-wide">
                              {shortLabel}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex min-h-[7rem] flex-1 flex-col overflow-hidden">
                    <p className="mb-1.5 shrink-0 px-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
                      {t("avatar")}
                    </p>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-lg border border-white/8 bg-black/20 p-1.5 [scrollbar-width:thin]">
                      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-7 lg:grid-cols-6">
                        {starterAvatarOptions().map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={avatarId === opt.id}
                            onClick={() =>
                              setAvatarId(avatarId === opt.id ? null : opt.id)
                            }
                            className={`relative aspect-square overflow-hidden rounded-md border transition ${
                              avatarId === opt.id
                                ? "border-[color-mix(in_srgb,var(--theme-primary)_60%,transparent)] ring-1 ring-[color-mix(in_srgb,var(--theme-primary)_35%,transparent)]"
                                : "border-white/8 bg-white/2 hover:border-white/22"
                            }`}
                          >
                            <AvatarImage
                              src={opt.src}
                              alt={opt.id}
                              className="trainer-sprite-thumb absolute inset-0 h-full w-full"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {error ? (
                    <p
                      role="alert"
                      className="shrink-0 rounded-lg border border-error/25 bg-error/10 px-3 py-2 text-center text-[12.5px] text-error"
                    >
                      {t(`errors.${error}`)}
                    </p>
                  ) : null}
                  {status === "success" ? (
                    <p className="shrink-0 rounded-lg border border-tertiary/25 bg-tertiary/10 px-3 py-2 text-center text-[12.5px] text-tertiary">
                      {t("success")}
                    </p>
                  ) : null}
                </div>

                <div className="shrink-0 border-t border-white/6 px-4 py-2 sm:px-5 sm:py-2.5">
                  <button
                    type="submit"
                    disabled={status !== "idle"}
                    className={`game-cta game-cta--red${status !== "idle" ? " game-cta--disabled" : ""}`}
                  >
                    <PokeballIcon className="h-4 w-4 shrink-0" />
                    <span className="game-cta__label">
                      {status === "submitting" ? t("submitting") : t("submit")}
                    </span>
                  </button>
                  <p className="mt-1.5 text-center text-[12px] text-white/42">
                    {t("hasAccount")}{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-white/78 underline-offset-2 transition hover:text-white hover:underline"
                    >
                      {t("loginLink")}
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>

      <LegalDisclaimer className="relative z-10 mx-auto max-w-xl shrink-0 px-3 pb-1.5 pt-0.5" />
    </div>
  );
}
