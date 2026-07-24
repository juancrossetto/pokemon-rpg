"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { registerUser } from "@/actions/register";
import { TextField } from "@/components/text-field";
import { CountrySelect } from "@/components/country-select";

export default function RegisterPage() {
  const t = useTranslations("auth.register");
  const locale = useLocale() as "es" | "en" | "pt";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "success">("idle");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setStatus("submitting");
    setError(null);

    const result = await registerUser({ email, username, password, country, locale });

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
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 bg-glass-surface backdrop-blur-xl border border-white/10 rounded-xl p-6"
      >
        <h1 className="text-headline-md text-white">{t("title")}</h1>

        <TextField
          label={t("username")}
          required
          minLength={3}
          maxLength={20}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <TextField
          label={t("email")}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <TextField
          label={t("password")}
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint={t("passwordHint")}
        />

        <CountrySelect
          label={t("country")}
          required
          value={country}
          onChange={setCountry}
          locale={locale}
          placeholder={t("countryPlaceholder")}
        />

        {error && <p className="text-label-sm text-error">{t(`errors.${error}`)}</p>}
        {status === "success" && (
          <p className="text-label-sm text-tertiary">{t("success")}</p>
        )}

        <button
          type="submit"
          disabled={status !== "idle"}
          className="w-full rounded-lg bg-pokeball-red px-4 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors disabled:opacity-50"
        >
          {status === "submitting" ? t("submitting") : t("submit")}
        </button>

        <p className="text-center text-label-sm text-on-surface-variant">
          {t("hasAccount")}{" "}
          <Link href="/login" className="text-on-surface font-bold">
            {t("loginLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
