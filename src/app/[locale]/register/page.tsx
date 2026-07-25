"use client";

import { useMemo, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { registerUser } from "@/actions/register";
import { TextField } from "@/components/text-field";
import { CountrySelect } from "@/components/country-select";
import { BiometricScanPanel } from "@/components/biometric-scan-panel";
import { AvatarImage } from "@/components/avatar-image";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BrandLogo } from "@/components/brand-logo";
import { AuthBackdrop } from "@/components/auth-backdrop";
import { AVATAR_OPTIONS } from "@/lib/avatars";

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
  const [country, setCountry] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [age, setAge] = useState("");
  const [avatarId, setAvatarId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  const progress = useMemo(() => {
    const fields = [username, email, password, country, gender, age, avatarId];
    const filled = fields.filter((f) => f !== null && f !== "").length;
    return Math.round((filled / fields.length) * 100);
  }, [username, email, password, country, gender, age, avatarId]);

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
      age: age.trim() ? Number(age) : null,
      avatarId,
    });

    if (!result.success) {
      setError(result.error);
      setStatus("idle");
      return;
    }

    setStatus("success");
    await signIn("credentials", { email, password, redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative isolate flex min-h-[calc(100dvh-3rem)] flex-1 flex-col md:min-h-[calc(100dvh-4rem)]">
      <AuthBackdrop />

      <div className="relative z-10 flex flex-1 flex-col items-center px-4 py-6 sm:px-6 md:py-10">
        <div className="mb-5 hidden text-center md:mb-6 md:block">
          <BrandLogo
            alt={tNav("brand")}
            priority
            sizes="240px"
            className="mx-auto h-auto w-[240px] drop-shadow-[0_2px_12px_rgba(0,0,0,0.55)]"
          />
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.28em] text-sky-200/90 drop-shadow">
            {tLogin("tagline")}
          </p>
        </div>

        <div className="w-full max-w-4xl overflow-hidden rounded-2xl border border-white/15 bg-[#0c1018]/90 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-xl md:rounded-[28px] md:border-sky-300/25 md:shadow-[0_0_0_1px_rgba(125,211,252,0.12),0_20px_60px_rgba(0,0,0,0.55),0_0_40px_rgba(56,189,248,0.15)]">
          <div className="grid lg:grid-cols-[280px_1fr]">
            <div className="hidden min-w-0 border-b border-white/10 lg:block lg:border-b-0 lg:border-r lg:border-white/10">
              <BiometricScanPanel />
            </div>

            <form onSubmit={handleSubmit} className="min-w-0 space-y-4 p-5 md:space-y-5 md:p-7">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-[#12161f] md:h-12 md:w-12">
                  <PokeballIcon className="h-6 w-6 md:h-7 md:w-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold tracking-tight text-white md:text-headline-md">
                    {t("panelTitle")}
                  </h1>
                  <p className="mt-0.5 text-sm text-white/60">{t("subtitle")}</p>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-black/35 px-3.5 py-2.5">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-[10px] font-mono uppercase tracking-wide">
                  <span className="truncate text-white/50">
                    {t("dataExtraction")}: {progress}%
                  </span>
                  <span className="truncate text-sky-300/90">{t("profileConfig")}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pokeball-red to-electric-yellow transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>

              <TextField
                label={t("username")}
                labelIcon="badge"
                icon="badge"
                accent="red"
                required
                minLength={3}
                maxLength={20}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />

              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                <div>
                  <label className="mb-1 flex items-center gap-1.5 text-label-sm uppercase tracking-wide text-electric-yellow">
                    <span className="material-symbols-outlined text-[14px]">wc</span>
                    {t("gender")}
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {GENDER_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={gender === opt.value}
                        onClick={() => setGender(gender === opt.value ? null : opt.value)}
                        title={t(
                          `gender${opt.value[0].toUpperCase()}${opt.value.slice(1)}` as "genderMale",
                        )}
                        className={`flex items-center justify-center rounded-xl border p-3 transition-all ${
                          gender === opt.value
                            ? "border-pokeball-red bg-pokeball-red/20 text-pokeball-red"
                            : "border-white/15 bg-black/45 text-on-surface-variant hover:border-sky-300/40"
                        }`}
                      >
                        <span className="material-symbols-outlined text-[20px]">{opt.icon}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <TextField
                  label={t("age")}
                  labelIcon="cake"
                  icon="123"
                  accent="red"
                  type="number"
                  min={5}
                  max={120}
                  placeholder={t("agePlaceholder")}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>

              <CountrySelect
                label={t("country")}
                labelIcon="public"
                required
                value={country}
                onChange={setCountry}
                locale={locale}
                placeholder={t("countryPlaceholder")}
              />

              <div className="rounded-xl border border-white/10 bg-black/35 p-3.5 md:p-4">
                <div className="mb-3 flex items-center justify-between border-b border-white/10 pb-2">
                  <span className="text-label-sm uppercase tracking-wide text-electric-yellow">
                    {t("avatar")}
                  </span>
                  <span className="font-mono text-[10px] text-white/45">{t("avatarMeta")}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {AVATAR_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      aria-pressed={avatarId === opt.id}
                      onClick={() => setAvatarId(avatarId === opt.id ? null : opt.id)}
                      className={`aspect-square overflow-hidden rounded-xl border-2 bg-black/40 transition-colors ${
                        avatarId === opt.id
                          ? "border-pokeball-red"
                          : "border-white/15 hover:border-sky-300/40"
                      }`}
                    >
                      <AvatarImage src={opt.src} alt={opt.id} className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              <TextField
                label={t("email")}
                labelIcon="alternate_email"
                icon="mail"
                accent="red"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />

              <TextField
                label={t("password")}
                labelIcon="vpn_key"
                icon="password"
                accent="red"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                hint={t("passwordHint")}
              />

              {error && (
                <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-label-sm text-error">
                  {t(`errors.${error}`)}
                </p>
              )}
              {status === "success" && (
                <p className="rounded-lg border border-tertiary/30 bg-tertiary/10 px-3 py-2 text-label-sm text-tertiary">
                  {t("success")}
                </p>
              )}

              <div className="flex flex-col gap-3 pt-1 sm:flex-row">
                <Link
                  href="/login"
                  className="flex flex-1 items-center justify-center rounded-full border border-white/15 bg-black/40 px-4 py-3 text-label-md font-bold uppercase tracking-wide text-white/70 transition hover:border-white/30 hover:text-white"
                >
                  {t("abort")}
                </Link>
                <button
                  type="submit"
                  disabled={status !== "idle"}
                  className="flex flex-[2] items-center justify-center gap-2 rounded-full bg-pokeball-red px-4 py-3 text-label-md font-bold uppercase tracking-wide text-white shadow-[0_10px_28px_rgba(238,21,21,0.35)] transition hover:bg-pokeball-red/90 disabled:opacity-50"
                >
                  {status === "submitting" ? t("submitting") : t("submit")}
                  <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
                </button>
              </div>

              <p className="text-center text-sm text-white/55">
                {t("hasAccount")}{" "}
                <Link href="/login" className="font-semibold text-sky-300 hover:text-sky-200">
                  {t("loginLink")}
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
