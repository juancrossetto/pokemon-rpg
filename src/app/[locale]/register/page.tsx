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
import { AVATAR_OPTIONS, avatarById } from "@/lib/avatars";
import { markBootSplashPending } from "@/lib/boot-splash";

type Gender = "male" | "female" | "unspecified";

const GENDER_OPTIONS: { value: Gender; icon: string }[] = [
  { value: "male", icon: "boy" },
  { value: "female", icon: "girl" },
  { value: "unspecified", icon: "transgender" },
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
    <div className="relative flex min-h-0 flex-1 items-end justify-center overflow-hidden rounded-2xl border border-white/10 bg-linear-to-b from-white/6 to-black/40 px-3 py-3">
      <div className="relative flex h-20 w-full max-w-[6.5rem] items-end justify-center sm:h-24 lg:h-full lg:max-h-56 lg:max-w-[10rem]">
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
          <span className="material-symbols-outlined relative z-10 text-[36px]! text-white/30 lg:text-[48px]!">
            person
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative isolate flex min-h-0 flex-1 flex-col">
      <AuthBackdrop />

      <div className="relative z-10 flex min-h-0 flex-1 flex-col px-3 py-2 sm:px-5 sm:py-3">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex h-full min-h-0 w-full max-w-[420px] flex-col lg:max-w-[860px]"
        >
          <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0c0e14]/92 shadow-[0_24px_64px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-pokeball-red/55 to-transparent"
            />
            <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(180px,0.8fr)_minmax(0,1.2fr)]">
              {/* Logo adentro de la card (columna preview) — no empuja el submit. */}
              <aside className="flex shrink-0 flex-col gap-2 border-b border-white/10 px-4 py-2.5 lg:min-h-0 lg:border-b-0 lg:border-r lg:border-white/10 lg:px-5 lg:py-4">
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
                <div
                  className={
                    selectedAvatar
                      ? "flex min-h-0 flex-1"
                      : "hidden lg:flex lg:min-h-0 lg:flex-1"
                  }
                >
                  {preview}
                </div>
              </aside>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="shrink-0 border-b border-white/8 px-5 py-2.5 sm:px-6 sm:py-3">
                  <p className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-pokeball-red">
                    <span className="h-1.5 w-1.5 rounded-full bg-pokeball-red" />
                    {t("eyebrow")}
                  </p>
                  <h1 className="text-[clamp(1.2rem,4vw,1.6rem)] font-semibold uppercase tracking-[0.04em] text-white">
                    {t("title")}
                  </h1>
                  <p className="mt-0.5 text-[12px] leading-snug text-white/50 sm:text-[13px]">
                    {t("subtitle")}
                  </p>
                </div>

                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-5 py-2.5 sm:space-y-3 sm:px-6 sm:py-3">
                  <label className="block">
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

                  <label className="block">
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

                  <label className="block">
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

                  <CountrySelect
                    compact
                    label={t("country")}
                    required
                    value={country}
                    onChange={setCountry}
                    locale={locale}
                    placeholder={t("countryPlaceholder")}
                  />

                  <div>
                    <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {t("gender")}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {GENDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          aria-pressed={gender === opt.value}
                          onClick={() =>
                            setGender(gender === opt.value ? null : opt.value)
                          }
                          title={t(
                            `gender${opt.value[0].toUpperCase()}${opt.value.slice(1)}` as "genderMale",
                          )}
                          className={`flex items-center justify-center rounded-xl border py-2 transition sm:py-2.5 ${
                            gender === opt.value
                              ? "border-pokeball-red bg-pokeball-red/20 text-pokeball-red"
                              : "border-white/12 bg-black/40 text-white/45 hover:border-white/25 hover:text-white/70"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[18px]!">
                            {opt.icon}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="mb-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
                      {t("avatar")}
                    </p>
                    <div className="max-h-24 overflow-y-auto overscroll-contain rounded-xl border border-white/10 bg-black/25 p-1.5 sm:max-h-32">
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
                    <p className="rounded-xl border border-error/30 bg-error/10 px-3 py-2 text-center text-[13px] text-error">
                      {t(`errors.${error}`)}
                    </p>
                  )}
                  {status === "success" && (
                    <p className="rounded-xl border border-tertiary/30 bg-tertiary/10 px-3 py-2 text-center text-[13px] text-tertiary">
                      {t("success")}
                    </p>
                  )}
                </div>

                <div className="shrink-0 border-t border-white/8 px-5 py-2.5 sm:px-6 sm:py-3">
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
                  <p className="mt-1.5 text-center text-[12px] text-white/45 sm:mt-2 sm:text-[13px]">
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
    </div>
  );
}
