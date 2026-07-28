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
        className="max-h-[22rem] overflow-y-auto rounded-xl border border-white/10 bg-black/20 p-2"
        role="listbox"
        aria-label={labels.pick}
      >
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
          {CLAN_EMBLEM_PRESET_IDS.map((id) => {
            const active = selectedId === id;
            return (
              <button
                key={id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => select(id)}
                className={`flex aspect-square min-h-11 items-center justify-center rounded-xl border p-1.5 transition-colors ${
                  active
                    ? "border-pokeball-red bg-pokeball-red/15"
                    : "border-white/10 bg-transparent hover:border-white/30 hover:bg-white/5"
                }`}
              >
                {/* img nativo: next/image comprime y aplasta los bordes geométricos */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clanEmblemPresetSrc(id)}
                  alt={id}
                  className="h-full w-full object-contain"
                  draggable={false}
                />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
