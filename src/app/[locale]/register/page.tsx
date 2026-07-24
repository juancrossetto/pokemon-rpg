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
import { AVATAR_OPTIONS } from "@/lib/avatars";

type Gender = "male" | "female" | "unspecified";

const GENDER_OPTIONS: { value: Gender; icon: string }[] = [
  { value: "male", icon: "boy" },
  { value: "female", icon: "girl" },
  { value: "unspecified", icon: "transgender" },
];

export default function RegisterPage() {
  const t = useTranslations("auth.register");
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

  // Progreso real (no un "paso 1 de 2" fabricado): % de campos completados.
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
    <div className="flex flex-1 items-center justify-center px-margin-mobile py-8">
      <div className="w-full max-w-4xl grid lg:grid-cols-[300px_1fr] border border-[#444] tech-border overflow-hidden bg-surface-container-lowest">
        <div className="min-w-0 border-b lg:border-b-0 lg:border-r border-[#333]">
          <BiometricScanPanel />
        </div>

        <form onSubmit={handleSubmit} className="min-w-0 p-6 lg:p-8 space-y-5 bg-surface-container/40">
          <div className="border border-[#444] bg-black/40 tech-border px-4 py-2.5">
            <div className="flex flex-wrap items-center justify-between text-label-sm text-[10px] font-mono uppercase tracking-wide mb-1.5 gap-x-3 gap-y-0.5">
              <span className="text-on-surface-variant/70 min-w-0 truncate">
                {t("dataExtraction")}: {progress}%
              </span>
              <span className="text-electric-yellow min-w-0 truncate">{t("profileConfig")}</span>
            </div>
            <div className="h-2 bg-black/60 border border-[#333] overflow-hidden">
              <div className="h-full profile-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-headline-md md:text-headline-lg text-on-surface font-black tracking-tight min-w-0 break-words">
                REG_ENTRENADOR
              </h1>
              <span className="material-symbols-outlined text-pokeball-red text-[24px] md:text-[28px] shrink-0">
                database
              </span>
            </div>
            <p className="text-label-sm text-electric-yellow mt-1">{t("subtitle")}</p>
            <div className="h-px bg-pokeball-red mt-3" />
          </div>

          <TextField
            label={t("username")}
            labelIcon="badge"
            icon="badge"
            required
            minLength={3}
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="flex items-center gap-1.5 text-label-sm text-electric-yellow uppercase tracking-wide mb-1">
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
                    title={t(`gender${opt.value[0].toUpperCase()}${opt.value.slice(1)}` as "genderMale")}
                    className={`flex items-center justify-center border p-3 tech-border transition-all ${
                      gender === opt.value
                        ? "border-pokeball-red bg-pokeball-red/20 text-pokeball-red"
                        : "border-[#555] bg-black/60 text-on-surface-variant hover:border-electric-yellow/50"
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

          <div className="bg-surface-container border border-[#444] tech-border p-4">
            <div className="flex justify-between items-center mb-3 border-b border-[#333] pb-2">
              <span className="text-label-sm text-electric-yellow uppercase tracking-wide">
                {t("avatar")}
              </span>
              <span className="text-label-sm text-[10px] text-on-surface-variant/60 font-mono">
                {t("avatarMeta")}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {AVATAR_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={avatarId === opt.id}
                  onClick={() => setAvatarId(avatarId === opt.id ? null : opt.id)}
                  className={`aspect-square border-2 bg-black/40 overflow-hidden transition-colors ${
                    avatarId === opt.id
                      ? "border-pokeball-red"
                      : "border-[#555] hover:border-electric-yellow/50"
                  }`}
                >
                  <AvatarImage src={opt.src} alt={opt.id} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          <TextField
            label={t("email")}
            labelIcon="alternate_email"
            icon="mail"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <TextField
            label={t("password")}
            labelIcon="vpn_key"
            icon="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={t("passwordHint")}
          />

          {error && <p className="text-label-sm text-error">{t(`errors.${error}`)}</p>}
          {status === "success" && <p className="text-label-sm text-tertiary">{t("success")}</p>}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/login"
              className="flex-1 flex items-center justify-center border border-[#555] bg-black/40 px-4 py-3 text-label-md text-on-surface-variant font-bold uppercase tracking-wide tech-border hover:border-white/40 hover:text-on-surface transition-colors"
            >
              {t("abort")}
            </Link>
            <button
              type="submit"
              disabled={status !== "idle"}
              className="flex-[2] flex items-center justify-center gap-2 bg-pokeball-red px-4 py-3 text-label-md text-white font-bold uppercase tracking-wide tech-border hover:bg-pokeball-red/80 transition-colors disabled:opacity-50"
            >
              {status === "submitting" ? t("submitting") : t("submit")}
              <span className="material-symbols-outlined text-[18px]">rocket_launch</span>
            </button>
          </div>

          <p className="text-center text-label-sm text-on-surface-variant">
            {t("hasAccount")}{" "}
            <Link href="/login" className="text-on-surface font-bold">
              {t("loginLink")}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
