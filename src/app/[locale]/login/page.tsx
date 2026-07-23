"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { TextField } from "@/components/text-field";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(false);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setSubmitting(false);
    if (result?.error) {
      setError(true);
      return;
    }
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
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <p className="text-label-sm text-error">{t("error")}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-pokeball-red px-4 py-2 text-label-md text-white hover:bg-pokeball-red/80 transition-colors disabled:opacity-50"
        >
          {submitting ? t("submitting") : t("submit")}
        </button>

        <p className="text-center text-label-sm text-on-surface-variant">
          {t("noAccount")}{" "}
          <Link href="/register" className="text-on-surface font-bold">
            {t("registerLink")}
          </Link>
        </p>
      </form>
    </div>
  );
}
