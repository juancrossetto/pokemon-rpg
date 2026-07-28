"use client";

import { useMemo, useState } from "react";
import {
  CLAN_EMBLEM_PRESET_IDS,
  DEFAULT_CLAN_EMBLEM,
  clanEmblemPresetSrc,
  isPresetEmblem,
  serializeClanEmblem,
  type ClanEmblem,
  type ClanEmblemPresetId,
} from "@/lib/clan-emblem";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";

type Labels = {
  pick: string;
  selected: string;
};

export function ClanEmblemEditor({
  name,
  initial,
  labels,
  value,
  onChange,
}: {
  name?: string;
  initial?: ClanEmblem;
  labels: Labels;
  value?: ClanEmblem;
  onChange?: (emblem: ClanEmblem) => void;
}) {
  const start = serializeClanEmblem(initial ?? DEFAULT_CLAN_EMBLEM);
  const [internal, setInternal] = useState<ClanEmblem>(start);
  const emblem = value ? serializeClanEmblem(value) : serializeClanEmblem(internal);
  const selectedId: ClanEmblemPresetId = isPresetEmblem(emblem)
    ? emblem.presetId
    : DEFAULT_CLAN_EMBLEM.presetId;

  function select(presetId: ClanEmblemPresetId) {
    const next = { kind: "preset" as const, presetId };
    if (onChange) onChange(next);
    else setInternal(next);
  }

  const json = useMemo(() => JSON.stringify(serializeClanEmblem(emblem)), [emblem]);

  return (
    <div className="flex flex-col gap-3">
      {name ? <input type="hidden" name={name} value={json} /> : null}

      <div className="flex items-center gap-4">
        <ClanEmblemBadge emblem={emblem} size={112} title={labels.selected} />
        <p className="text-label-sm text-on-surface-variant">{labels.pick}</p>
      </div>

      <div
        className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 max-h-[22rem] overflow-y-auto pr-1"
        role="listbox"
        aria-label={labels.pick}
      >
        {CLAN_EMBLEM_PRESET_IDS.map((id) => {
          const active = selectedId === id;
          return (
            <button
              key={id}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => select(id)}
              className={`relative aspect-square min-h-11 rounded-xl border bg-transparent transition-colors ${
                active
                  ? "border-pokeball-red/70 ring-2 ring-pokeball-red/40"
                  : "border-white/10 hover:border-white/30"
              }`}
            >
              {/* img nativo: next/image comprime y aplasta los bordes geométricos */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clanEmblemPresetSrc(id)}
                alt={id}
                className="absolute inset-0 m-auto h-[86%] w-[86%] object-contain"
                draggable={false}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
