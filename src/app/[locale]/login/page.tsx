"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { TextField } from "@/components/text-field";
import { AuthRadar } from "@/components/auth-radar";

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
    <div className="flex flex-1 flex-col items-center px-margin-mobile py-8">
      <AuthRadar
        brandPrefix={t("brandPrefix")}
        brandAccent={t("brandAccent")}
        status={t("bootStatus")}
      />

      <form onSubmit={handleSubmit} className="w-full flex justify-center">
        <div className="relative w-full max-w-sm">
          <span className="absolute -top-px -left-px w-4 h-4 border-t-2 border-l-2 border-pokeball-red z-10" />
          <span className="absolute -top-px -right-px w-4 h-4 border-t-2 border-r-2 border-secondary z-10" />
          <span className="absolute -bottom-px -left-px w-4 h-4 border-b-2 border-l-2 border-secondary z-10" />
          <span className="absolute -bottom-px -right-px w-4 h-4 border-b-2 border-r-2 border-pokeball-red z-10" />

          <div className="bg-glass-surface backdrop-blur-xl border border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-electric-yellow text-[20px]">
                  target
                </span>
                <h2 className="text-label-md text-electric-yellow font-bold uppercase tracking-widest">
                  {t("panelTitle")}
                </h2>
              </div>
              <span className="material-symbols-outlined text-on-surface-variant/40 text-[18px]">
                qr_code_2
              </span>
            </div>

            <TextField
              label={t("email")}
              meta={t("metaRequired")}
              icon="badge"
              accent="red"
              type="email"
              required
              statusDot
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <TextField
              label={t("password")}
              meta={t("metaEncrypted")}
              icon="password"
              accent="red"
              type="password"
              required
              statusDot
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <p className="text-label-sm text-error">{t("error")}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-pokeball-red px-4 py-3 text-label-md text-white font-bold uppercase tracking-wide tech-border hover:bg-pokeball-red/80 transition-colors disabled:opacity-50"
            >
              {submitting ? t("submitting") : t("submit")}
              <span className="material-symbols-outlined text-[18px]">bolt</span>
            </button>

            <div className="flex items-center justify-center gap-3 text-label-sm text-on-surface-variant">
              <Link
                href="/register"
                className="flex items-center gap-1 underline underline-offset-4 hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">person_add</span>
                {t("registerLink")}
              </Link>
              <span className="text-white/20">|</span>
              <Link
                href="/pokedex"
                className="flex items-center gap-1 underline underline-offset-4 hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[16px]">help</span>
                {t("guestAccess")}
              </Link>
            </div>
          </div>
        </div>
      </form>

      <div className="w-full max-w-sm mt-4 flex items-center justify-between gap-3 text-label-sm text-[10px] text-on-surface-variant/50 font-mono uppercase">
        <span className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[14px]">lan</span>
          {t("networkLine")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-electric-yellow" />
          {t("systemStatus")}
        </span>
      </div>
    </div>
  );
}
