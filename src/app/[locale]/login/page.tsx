"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { PokeballIcon } from "@/components/pokeball-icon";
import { BrandLogo } from "@/components/brand-logo";
import { AuthBackdrop } from "@/components/auth-backdrop";
import { markBootSplashPending } from "@/lib/boot-splash";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(false);

    const result = await signIn("credentials", {
      email,
      password,
      remember: remember ? "true" : "false",
      redirect: false,
    });

    setSubmitting(false);
    if (result?.error) {
      setError(true);
      return;
    }
    markBootSplashPending();
    router.push("/");
    router.refresh();
  }

  const fieldClass =
    "w-full border border-white/15 bg-black/50 py-2.5 pl-10 pr-3 text-label-md font-mono text-on-surface outline-none transition placeholder:text-on-surface-variant/45 focus:border-pokeball-red/70 focus:ring-1 focus:ring-pokeball-red/40";

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
            {t("tagline")}
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center py-4 md:py-6">
          <form onSubmit={handleSubmit} className="w-full max-w-[380px] md:max-w-[420px]">
            <div className="glass-panel relative px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
              <div className="mb-3.5 flex items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-surface-container-high">
                  <PokeballIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <h1 className="truncate text-label-md text-on-surface">{t("welcomeTitle")}</h1>
                  <p className="truncate text-label-sm text-on-surface-variant/80">
                    {t("welcomeSubtitle")}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
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
                      autoComplete="current-password"
                      placeholder={t("password")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${fieldClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t("hidePassword") : t("showPassword")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-on-surface-variant/65 transition hover:text-on-surface"
                    >
                      <span className="material-symbols-outlined text-[18px]!">
                        {showPassword ? "visibility_off" : "visibility"}
                      </span>
                    </button>
                  </div>
                </label>

                <label className="flex cursor-pointer items-center gap-2 px-0.5 py-0.5 text-label-sm text-on-surface-variant">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-3.5 w-3.5 rounded-sm border-white/25 bg-black/50 text-pokeball-red focus:ring-pokeball-red/40"
                  />
                  {t("rememberMe")}
                </label>

                {error && (
                  <p className="rounded-lg border border-error/30 bg-error/10 px-3 py-1.5 text-center text-label-sm text-error">
                    {t("error")}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="ui-btn-primary w-full px-4 py-2.5 text-label-md"
                >
                  <PokeballIcon className="h-3.5 w-3.5" />
                  {submitting ? t("submitting") : t("submit")}
                </button>
              </div>

              <div className="mt-3 text-label-sm text-on-surface-variant">
                <p>
                  {t("noAccount")}{" "}
                  <Link
                    href="/register"
                    className="text-secondary underline-offset-2 hover:text-on-surface hover:underline"
                  >
                    {t("registerLinkHere")}
                  </Link>
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
