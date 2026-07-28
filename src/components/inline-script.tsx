"use client";

/**
 * Script inline seguro ante soft-nav (cambio de locale, etc.).
 * En SSR corre como JS; en el cliente React lo marca como texto inerte
 * para no avisar ni intentar re-ejecutarlo.
 * @see https://nextjs.org/docs/app/guides/preventing-flash-before-hydration
 */
export function InlineScript({ id, html }: { id: string; html: string }) {
  return (
    <script
      id={id}
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
