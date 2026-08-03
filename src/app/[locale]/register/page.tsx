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
    "w-full border border-white/15 bg-black/50 py-2.5 pl-10 pr-3 text-label-md font-mono text-on-surface outline-none transition placeholder:text-on-surface-variant/45 focus:border-pokeball-red/70 focus:ring-1 focus:ring-pokeball-red/40";

  const preview = (
    <div className="relative flex items-end justify-center overflow-hidden rounded-xl border border-white/12 bg-linear-to-b from-white/6 to-black/40 px-3 py-3">
      <div className="relative flex h-24 w-full max-w-[7.5rem] items-end justify-center sm:h-28 md:h-44 md:max-w-[11rem]">
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
          <span className="material-symbols-outlined relative z-10 text-[36px]! text-on-surface-variant/40 md:text-[48px]!">
            person
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-3rem)] flex-1 flex-col md:min-h-[calc(100dvh-4rem)]">
      <AuthBackdrop />

      <div className="relative z-10 flex flex-1 flex-col px-4 sm:px-6">
        <div className="hidden shrink-0 pt-3 text-center md:block md:pt-4">
          <BrandLogo
            alt={tNav("brand")}
            priority
            sizes="180px"
            className="mx-auto h-auto w-[180px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
          />
          <p className="mt-1 text-label-sm uppercase tracking-[0.28em] text-secondary">
            {tLogin("tagline")}
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4 md:py-6">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-[420px] lg:max-w-[860px]"
          >
            <div className="glass-panel relative overflow-hidden shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
              <div className="grid lg:grid-cols-[minmax(240px,0.9fr)_minmax(0,1.15fr)]">
                {/* Preview *2.png: en mobile solo si hay selección; desktop siempre */}
                <aside className="border-b border-white/10 px-4 py-2.5 lg:border-b-0 lg:border-r lg:p-5">
                  <div className={selectedAvatar ? "block" : "hidden lg:block"}>{preview}</div>
                </aside>

                <div className="flex max-h-[min(78dvh,40rem)] flex-col lg:max-h-none">
                  <div className="shrink-0 border-b border-white/8 px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-surface-container-high">
                        <PokeballIcon className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <h1 className="text-label-md text-on-surface">{t("title")}</h1>
                        <p className="text-label-sm text-on-surface-variant/80">{t("subtitle")}</p>
                      </div>
                    </div>
                  </div>

                  <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-5 py-4">
                    <label className="block">
                      <span className="sr-only">{t("username")}</span>
                      <div className="relative tech-border">
                        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px]! text-on-surface-variant/65">
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
                      <div className="relative tech-border">
                        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px]! text-on-surface-variant/65">
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
                      <div className="relative tech-border">
                        <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px]! text-on-surface-variant/65">
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
                          className={`${fieldClass} pr-10`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={
                            showPassword ? tLogin("hidePassword") : tLogin("showPassword")
                          }
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant/65 transition hover:text-on-surface"
                        >
                          <span className="material-symbols-outlined text-[18px]!">
                            {showPassword ? "visibility_off" : "visibility"}
                          </span>
                        </button>
                      </div>
                      <p className="mt-1 px-0.5 text-[11px] text-on-surface-variant/70">
                        {t("passwordHint")}
                      </p>
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
                      <p className="mb-1.5 px-0.5 text-[11px] uppercase tracking-wide text-on-surface-variant/70">
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
                            className={`flex items-center justify-center rounded-md border py-2 transition ${
                              gender === opt.value
                                ? "border-pokeball-red bg-pokeball-red/20 text-pokeball-red"
                                : "border-white/15 bg-black/45 text-on-surface-variant hover:border-white/30"
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
                      <p className="mb-1.5 px-0.5 text-[11px] uppercase tracking-wide text-on-surface-variant/70">
                        {t("avatar")}
                      </p>
                      <div className="max-h-40 overflow-y-auto overscroll-contain rounded-md border border-white/10 bg-black/20 p-1.5 sm:max-h-48">
                        <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-7 lg:grid-cols-6">
                          {AVATAR_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              aria-pressed={avatarId === opt.id}
                              onClick={() =>
                                setAvatarId(avatarId === opt.id ? null : opt.id)
                              }
                              className={`aspect-square overflow-hidden rounded-md border-2 bg-black/40 transition ${
                                avatarId === opt.id
                                  ? "border-pokeball-red ring-1 ring-pokeball-red/40"
                                  : "border-white/15 hover:border-white/30"
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
                      <p className="rounded-md border border-error/30 bg-error/10 px-3 py-1.5 text-center text-label-sm text-error">
                        {t(`errors.${error}`)}
                      </p>
                    )}
                    {status === "success" && (
                      <p className="rounded-md border border-tertiary/30 bg-tertiary/10 px-3 py-1.5 text-center text-label-sm text-tertiary">
                        {t("success")}
                      </p>
                    )}
                  </div>

                  <div className="shrink-0 border-t border-white/8 px-5 py-3.5">
                    <button
                      type="submit"
                      disabled={status !== "idle"}
                      className="ui-btn-primary w-full px-4 py-2.5 text-label-md"
                    >
                      <PokeballIcon className="h-3.5 w-3.5" />
                      {status === "submitting" ? t("submitting") : t("submit")}
                    </button>
                    <p className="mt-3 text-center text-label-sm text-on-surface-variant">
                      {t("hasAccount")}{" "}
                      <Link
                        href="/login"
                        className="text-secondary underline-offset-2 hover:text-on-surface hover:underline"
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
    </div>
  );
}
