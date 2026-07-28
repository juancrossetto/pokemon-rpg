"use client";

/** Una línea bajo el título del hub: dice el rol de la pantalla. */
export function HubRoleHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1 max-w-2xl text-label-md text-on-surface-variant/90 md:text-body-md">
      {children}
    </p>
  );
}
