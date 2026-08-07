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
import { AVATAR_OPTIONS, avatarById } from "@/lib/avatars";
import { markBootSplashPending } from "@/lib/boot-splash";

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
    router.push("/starter");
    router.refresh();
  }

  const fieldClass =
    "w-full rounded-xl border border-white/12 bg-black/45 py-2.5 pl-11 pr-3 text-[16px] text-white outline-none transition placeholder:text-white/35 focus:border-pokeball-red/55 focus:bg-black/55 focus:ring-1 focus:ring-pokeball-red/30 sm:py-3";

  const preview = (
    <div className="relative mx-auto flex w-full max-w-[9.5rem] items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-linear-to-b from-white/6 to-black/40 px-3 py-3 lg:max-w-[11rem]">
      <div className="relative flex h-28 w-full items-end justify-center sm:h-32 lg:h-40">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-4 bottom-0 h-1/2 rounded-full bg-pokeball-red/10 blur-2xl"
        />
        {selectedAvatar ? (
          <AvatarImage
            src={selectedAvatar.profileSrc}
            alt={selectedAvatar.id}
            className="relative z-10 h-full w-auto max-w-full object-contain object-bottom drop-shadow-[0_8px_16px_rgba(0,0,0,0.55)]"
          />
        ) : (
          <span className="material-symbols-outlined relative z-10 text-[40px]! text-white/30 lg:text-[48px]!">
            person
          </span>
        )}
      </div>
    </div>
  );

  return (
    /* Alto = viewport − header (app-main ya aplica el pt). Sin esto el
       documento crece y aparece el scrollbar general del browser. */
    <div className="relative isolate flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] max-h-[calc(100dvh-3.5rem-env(safe-area-inset-top))] flex-col overflow-hidden xl:h-[calc(100dvh-3.5rem)] xl:max-h-[calc(100dvh-3.5rem)]">
      <AuthBackdrop />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 py-1.5 sm:px-5 sm:py-2">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex h-full min-h-0 w-full max-w-[420px] flex-col lg:max-w-[860px]"
        >
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/92 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-pokeball-red/55 to-transparent"
            />
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(200px,240px)_minmax(0,1fr)] lg:items-stretch">
              <aside className="flex shrink-0 flex-col justify-center gap-3 border-b border-white/10 px-4 py-3 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-5 lg:py-5">
                <div className="shrink-0 text-center">
                  <BrandLogo
                    alt={tNav("brand")}
                    priority
                    sizes="140px"
                    className="mx-auto h-auto w-[100px] drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)] sm:w-[120px] lg:w-[130px]"
                  />
                  <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.24em] text-white/40">
                    {tLogin("tagline")}
                  </p>
                </div>
                <div className={selectedAvatar ? "block" : "hidden lg:block"}>
                  {preview}
                </div>
              </aside>

              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-white/8 px-4 py-2 sm:px-5 sm:py-2.5">
                  <p className="mb-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-pokeball-red">
                    <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
                    {t("eyebrow")}
                  </p>
                  <h1 className="text-[clamp(1.15rem,3.8vw,1.45rem)] font-semibold uppercase tracking-[0.04em] text-white">
                    {t("title")}
                  </h1>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/50">
                    {t("subtitle")}
                  </p>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden px-4 py-2 sm:gap-2.5 sm:px-5 sm:py-2.5">
                  <label className="block shrink-0">
                    <span className="sr-only">{t("username")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]! text-white/40">
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
                        className={fieldClass}
                      />
                    </div>
                  </label>

                  <label className="block shrink-0">
                    <span className="sr-only">{t("email")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]! text-white/40">
                        mail
                      </span>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        placeholder={t("email")}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={fieldClass}
                      />
                    </div>
                  </label>

                  <label className="block shrink-0">
                    <span className="sr-only">{t("password")}</span>
                    <div className="relative">
                      <span className="material-symbols-outlined pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[18px]! text-white/40">
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
                        className={`${fieldClass} pr-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        aria-label={
                          showPassword ? tLogin("hidePassword") : tLogin("showPassword")
                        }
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-white/40 transition hover:text-white/80"
                      >
                        <span className="material-symbols-outlined text-[18px]!">
                          {showPassword ? "visibility_off" : "visibility"}
                        </span>
                      </button>
                    </div>
                    <p className="mt-1 px-0.5 text-[11px] text-white/40">{t("passwordHint")}</p>
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
                    <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
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
                            onClick={() =>
                              setGender(selected ? null : opt.value)
                            }
                            className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1.5 transition ${
                              selected
                                ? "border-pokeball-red bg-pokeball-red/20 text-pokeball-red"
                                : "border-white/12 bg-black/40 text-white/55 hover:border-white/25 hover:text-white/80"
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

                  <div className="flex min-h-0 flex-1 flex-col">
                    <p className="mb-1.5 shrink-0 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {t("avatar")}
                    </p>
                    {/* Único scroll interno: la grilla ocupa el resto del alto. */}
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/25 p-1.5 [scrollbar-width:thin]">
                      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-7 lg:grid-cols-6">
                        {AVATAR_OPTIONS.map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            aria-pressed={avatarId === opt.id}
                            onClick={() =>
                              setAvatarId(avatarId === opt.id ? null : opt.id)
                            }
                            className={`aspect-square overflow-hidden rounded-lg border-2 bg-black/40 transition ${
                              avatarId === opt.id
                                ? "border-pokeball-red ring-1 ring-pokeball-red/40"
                                : "border-white/12 hover:border-white/30"
                            }`}
                          >
                            <AvatarImage
                              src={opt.src}
                              alt={opt.id}
                              className="trainer-sprite-thumb h-full w-full"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {error && (
                    <p className="shrink-0 rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-center text-[13px] text-error">
                      {t(`errors.${error}`)}
                    </p>
                  )}
                  {status === "success" && (
                    <p className="shrink-0 rounded-xl border border-tertiary/30 bg-tertiary/10 px-3 py-2 text-center text-[13px] text-tertiary">
                      {t("success")}
                    </p>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/8 px-4 py-2 sm:px-5 sm:py-2.5">
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
                  <p className="mt-1.5 text-center text-[12px] text-white/45">
                    {t("hasAccount")}{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-white/80 underline-offset-2 transition hover:text-white hover:underline"
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
