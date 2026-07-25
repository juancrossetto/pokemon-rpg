import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { typeColor } from "@/lib/type-colors";
import { typeIcon } from "@/lib/type-icons";
import { gymBadgeImageUrl, gymLeaderPortraitUrl } from "@/lib/gym-art";
import type { GymStatus } from "@/lib/gym-status";

// Card de gimnasio de la lista. Un solo layout para todos los anchos: el
// retrato define la altura y la columna de contenido tiene dos filas fijas
// (título+líder / equipo+recompensa+estado). Antes había un bloque de título
// duplicado —uno `sm:hidden` y otro `hidden sm:flex`— que había que mantener
// en paralelo y hacía la card innecesariamente alta en mobile.
export async function GymCard({ status }: { status: GymStatus }) {
  const { gym, badgeEarned, locked, onCooldown, hoursLeft } = status;
  const t = await getTranslations("gyms");

  const color = typeColor(gym.type);
  const portrait = gymLeaderPortraitUrl(gym.leaderName);
  const badgeSrc = gymBadgeImageUrl(gym.type);

  // Tipografía sans y compacta, no la escala `label`: es monoespaciada con
  // letter-spacing 0.08em y hacía que "Medalla obtenida" midiera 177px, lo que
  // empujaba el chip a una segunda línea en casi todas las cards en mobile.
  const chipBase =
    "inline-flex items-center gap-1 rounded-full border px-1.5 py-1 text-[11px] leading-none font-medium whitespace-nowrap";

  // Si está bloqueado, el candado del retrato alcanza — no duplicamos con chip.
  const statusChip = badgeEarned ? (
    <span className={`${chipBase} bg-tertiary/15 border-tertiary/40 text-tertiary`}>
      <span className="material-symbols-outlined text-[13px]! leading-none">check_circle</span>
      {t("badgeEarned")}
    </span>
  ) : locked ? null : onCooldown ? (
    // Sin ícono: "Disponible en {h}h" ya dice que es tiempo, y es el chip más
    // largo — el reloj lo empujaba a una segunda línea en mobile.
    <span className={`${chipBase} bg-error/10 border-error/30 text-error`}>
      {t("cooldownHint", { hours: hoursLeft })}
    </span>
  ) : (
    <span className={`${chipBase} bg-pokeball-red/15 border-pokeball-red/40 text-pokeball-red font-bold`}>
      {t("challenge")}
      <span className="material-symbols-outlined text-[13px]! leading-none">arrow_forward</span>
    </span>
  );

  const card = (
    <article
      className={`relative overflow-hidden rounded-xl border backdrop-blur-xl transition-all ${
        badgeEarned
          ? "border-tertiary/40 bg-glass-surface"
          : locked
            ? "border-white/5 bg-glass-surface opacity-60"
            : "border-white/10 bg-glass-surface hover:border-pokeball-red/45 hover:bg-surface-container/80"
      }`}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-25"
        style={{ background: `linear-gradient(105deg, ${color}33 0%, transparent 48%)` }}
      />

      <div className="relative flex gap-2.5 sm:gap-3 p-2.5">
        {/* Retrato del líder */}
        <div
          className="relative w-[56px] h-[68px] sm:w-20 sm:h-[88px] rounded-lg overflow-hidden shrink-0 border"
          style={{ borderColor: `${color}88`, boxShadow: `0 0 16px ${color}22` }}
        >
          {portrait ? (
            <Image
              src={portrait}
              alt={gym.leaderName}
              fill
              sizes="(min-width: 640px) 80px, 56px"
              className="object-cover object-top"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ backgroundColor: `${color}22` }}
            >
              <span className="material-symbols-outlined text-[24px]! sm:text-[28px]!" style={{ color }}>
                {typeIcon(gym.type)}
              </span>
            </div>
          )}
          <span
            className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 rounded px-1 py-0.5 text-[10px] font-mono font-bold leading-none text-white/90 backdrop-blur-sm"
            style={{ backgroundColor: `${color}cc` }}
          >
            #{gym.order}
          </span>
          {locked && (
            <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
              <span className="material-symbols-outlined text-white/80 text-[20px]! sm:text-[22px]!">
                lock
              </span>
            </div>
          )}
        </div>

        {/* Contenido */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-1.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {/* Sans y no la escala mono `label`: el nombre es lo primero que
                  se escanea y el letter-spacing del mono lo hacía desbordar.
                  Tamaños en valores arbitrarios y no `sm:text-headline-md`: la
                  escala custom vive como CSS plano en @layer utilities, así que
                  Tailwind no genera sus variantes responsive (sm:/md: no hacen
                  nada). 24px replica el tamaño que la card tenía en desktop. */}
              <h2 className="text-[15px] leading-tight sm:text-[20px] sm:leading-7 font-semibold text-white truncate">
                {gym.name}
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                <span className="text-label-sm text-on-surface-variant truncate">
                  {t("leaderLabel", { name: gym.leaderName })}
                </span>
                <span
                  className="shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase leading-none border"
                  style={{ backgroundColor: `${color}33`, color, borderColor: `${color}55` }}
                >
                  {gym.type}
                </span>
              </div>
            </div>

            <div
              className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg border flex items-center justify-center ${
                badgeEarned
                  ? "border-tertiary/50 bg-tertiary/10"
                  : "border-white/10 bg-surface-container-high/80"
              }`}
              title={gym.badgeName}
            >
              <Image
                src={badgeSrc}
                alt={gym.badgeName}
                width={28}
                height={28}
                className={`w-5.5 h-5.5 sm:w-6 sm:h-6 object-contain ${
                  badgeEarned ? "drop-shadow-[0_0_6px_rgba(242,192,0,0.55)]" : "opacity-80"
                }`}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex -space-x-1.5 shrink-0">
              {gym.team.map((member) => (
                <div
                  key={member.id}
                  className="w-[22px] h-[22px] sm:w-6 sm:h-6 rounded-full bg-surface-container-highest border border-white/15 overflow-hidden"
                  title={`${member.species.name} · ${t("levelLabel", { level: member.level })}`}
                >
                  {member.species.spriteUrl && (
                    <Image
                      src={member.species.spriteUrl}
                      alt={member.species.name}
                      width={28}
                      height={28}
                      className="w-full h-full object-contain"
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Solo el ícono + el número: "monedas" duplicaba el significado
                del ícono y en mobile empujaba el chip de estado a otra línea. */}
            <span
              className="inline-flex items-center gap-0.5 text-[11px] font-mono text-electric-yellow shrink-0"
              title={t("coinReward", { coins: gym.coinReward })}
            >
              <span className="material-symbols-outlined text-[13px]! leading-none">paid</span>+{gym.coinReward}
            </span>

            {statusChip ? <div className="ml-auto shrink-0">{statusChip}</div> : null}
          </div>
        </div>
      </div>
    </article>
  );

  return locked ? (
    <div>{card}</div>
  ) : (
    <Link href={`/gyms/${gym.id}`} className="block group">
      {card}
    </Link>
  );
}
