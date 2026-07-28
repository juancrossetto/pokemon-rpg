"use client";

import { useState } from "react";
import {
  CLAN_AFFINITIES,
  CLAN_CREATION_COST,
  CLAN_DESC_MAX,
  CLAN_FOCUSES,
  CLAN_JOIN_POLICIES,
  CLAN_MOTTO_MAX,
  CLAN_NAME_MAX,
  CLAN_NAME_MIN,
  CLAN_TAG_MAX,
  CLAN_TAG_MIN,
} from "@/lib/clan-rules";
import type { ClanAffinity, ClanFocus, ClanJoinPolicy } from "@/lib/clan-types";
import { DEFAULT_CLAN_EMBLEM, type ClanEmblem } from "@/lib/clan-emblem";
import { ClanEmblemEditor } from "@/components/clans/clan-emblem-editor";
import { ClanEmblemBadge } from "@/components/clans/clan-emblem-badge";
import { SubmitButton } from "@/components/submit-button";
import { createClan } from "@/actions/clan";
import { ClanAffinityChip } from "@/components/clans/clan-affinity-chip";

type Labels = {
  steps: { identity: string; emblem: string; style: string; rules: string; confirm: string };
  next: string;
  back: string;
  nameLabel: string;
  namePlaceholder: string;
  tagLabel: string;
  tagPlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  mottoLabel: string;
  mottoPlaceholder: string;
  affinityLabel: string;
  focusLabel: string;
  joinPolicyLabel: string;
  languageLabel: string;
  minLevelLabel: string;
  minLevelHint: string;
  createCost: string;
  createButton: string;
  creating: string;
  noFunds: string;
  affinities: Record<ClanAffinity, string>;
  focuses: Record<ClanFocus, string>;
  joinPolicies: Record<ClanJoinPolicy, string>;
  languages: { any: string; es: string; en: string; pt: string };
  emblem: {
    pick: string;
    selected: string;
  };
};

const STEPS = ["identity", "emblem", "style", "rules", "confirm"] as const;

export function ClanCreateWizard({
  locale,
  coins,
  labels,
}: {
  locale: string;
  coins: number;
  labels: Labels;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [description, setDescription] = useState("");
  const [motto, setMotto] = useState("");
  const [affinity, setAffinity] = useState<ClanAffinity>("NORMAL");
  const [focus, setFocus] = useState<ClanFocus>("MIXED");
  const [joinPolicy, setJoinPolicy] = useState<ClanJoinPolicy>("OPEN");
  const [language, setLanguage] = useState("");
  const [minLevel, setMinLevel] = useState("");
  const [emblem, setEmblem] = useState<ClanEmblem>({ ...DEFAULT_CLAN_EMBLEM });

  const canAfford = coins >= CLAN_CREATION_COST;
  const current = STEPS[step];

  return (
    <form
      action={createClan.bind(null, locale)}
      className="rounded-2xl border border-white/10 bg-glass-surface overflow-hidden"
    >
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="tag" value={tag} />
      <input type="hidden" name="description" value={description} />
      <input type="hidden" name="motto" value={motto} />
      <input type="hidden" name="affinity" value={affinity} />
      <input type="hidden" name="focus" value={focus} />
      <input type="hidden" name="joinPolicy" value={joinPolicy} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="minPlayerLevel" value={minLevel} />
      <input type="hidden" name="emblem" value={JSON.stringify(emblem)} />

      <div className="border-b border-white/5 px-4 py-3 flex gap-1 overflow-x-auto">
        {STEPS.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(i)}
            className={`min-h-11 shrink-0 px-3 rounded-lg text-label-sm transition-colors ${
              i === step
                ? "bg-pokeball-red/20 text-on-surface border border-pokeball-red/40"
                : "text-on-surface-variant border border-transparent hover:border-white/10"
            }`}
            aria-current={i === step ? "step" : undefined}
          >
            {i + 1}. {labels.steps[s]}
          </button>
        ))}
      </div>

      <div className="p-4 md:p-5 flex flex-col gap-4">
        {current === "identity" && (
          <>
            <div className="grid gap-3 md:grid-cols-[1fr_8rem]">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant" htmlFor="clan-name">
                  {labels.nameLabel}
                </label>
                <input
                  id="clan-name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  minLength={CLAN_NAME_MIN}
                  maxLength={CLAN_NAME_MAX}
                  placeholder={labels.namePlaceholder}
                  className="min-h-11 bg-surface-container border border-white/10 rounded-lg px-3 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant" htmlFor="clan-tag">
                  {labels.tagLabel}
                </label>
                <input
                  id="clan-tag"
                  required
                  value={tag}
                  onChange={(e) => setTag(e.target.value.toUpperCase())}
                  minLength={CLAN_TAG_MIN}
                  maxLength={CLAN_TAG_MAX}
                  placeholder={labels.tagPlaceholder}
                  className="min-h-11 bg-surface-container border border-white/10 rounded-lg px-3 text-label-md text-on-surface uppercase font-mono placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-sm text-on-surface-variant" htmlFor="clan-motto">
                {labels.mottoLabel}
              </label>
              <input
                id="clan-motto"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
                maxLength={CLAN_MOTTO_MAX}
                placeholder={labels.mottoPlaceholder}
                className="min-h-11 bg-surface-container border border-white/10 rounded-lg px-3 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-label-sm text-on-surface-variant" htmlFor="clan-desc">
                {labels.descriptionLabel}
              </label>
              <textarea
                id="clan-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={CLAN_DESC_MAX}
                rows={3}
                placeholder={labels.descriptionPlaceholder}
                className="bg-surface-container border border-white/10 rounded-lg px-3 py-2 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-pokeball-red/50 resize-y"
              />
            </div>
          </>
        )}

        {current === "emblem" && (
          <ClanEmblemEditor
            value={emblem}
            onChange={setEmblem}
            labels={labels.emblem}
          />
        )}

        {current === "style" && (
          <>
            <fieldset>
              <legend className="text-label-sm text-on-surface-variant mb-2">
                {labels.affinityLabel}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {CLAN_AFFINITIES.map((a) => (
                  <ClanAffinityChip
                    key={a}
                    affinity={a}
                    label={labels.affinities[a]}
                    selected={affinity === a}
                    onClick={() => setAffinity(a)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="text-label-sm text-on-surface-variant mb-2">
                {labels.focusLabel}
              </legend>
              <div className="flex flex-wrap gap-1.5">
                {CLAN_FOCUSES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFocus(f)}
                    className={`min-h-11 px-3 rounded-lg border text-label-sm ${
                      focus === f
                        ? "border-pokeball-red/50 bg-pokeball-red/15 text-on-surface"
                        : "border-white/10 text-on-surface-variant"
                    }`}
                  >
                    {labels.focuses[f]}
                  </button>
                ))}
              </div>
            </fieldset>
          </>
        )}

        {current === "rules" && (
          <>
            <fieldset>
              <legend className="text-label-sm text-on-surface-variant mb-2">
                {labels.joinPolicyLabel}
              </legend>
              <div className="flex flex-col gap-1.5">
                {CLAN_JOIN_POLICIES.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setJoinPolicy(p)}
                    className={`min-h-11 px-3 rounded-lg border text-left text-label-sm ${
                      joinPolicy === p
                        ? "border-pokeball-red/50 bg-pokeball-red/15 text-on-surface"
                        : "border-white/10 text-on-surface-variant"
                    }`}
                  >
                    {labels.joinPolicies[p]}
                  </button>
                ))}
              </div>
            </fieldset>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant" htmlFor="clan-lang">
                  {labels.languageLabel}
                </label>
                <select
                  id="clan-lang"
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  className="min-h-11 bg-surface-container border border-white/10 rounded-lg px-3 text-label-md text-on-surface"
                >
                  <option value="">{labels.languages.any}</option>
                  <option value="es">{labels.languages.es}</option>
                  <option value="en">{labels.languages.en}</option>
                  <option value="pt">{labels.languages.pt}</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-label-sm text-on-surface-variant" htmlFor="clan-min">
                  {labels.minLevelLabel}
                </label>
                <input
                  id="clan-min"
                  type="number"
                  min={1}
                  max={100}
                  value={minLevel}
                  onChange={(e) => setMinLevel(e.target.value)}
                  placeholder={labels.minLevelHint}
                  className="min-h-11 bg-surface-container border border-white/10 rounded-lg px-3 text-label-md text-on-surface"
                />
              </div>
            </div>
          </>
        )}

        {current === "confirm" && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-surface-container/40 p-3">
              <ClanEmblemBadge emblem={emblem} size={56} />
              <div className="min-w-0">
                <div className="text-headline-md text-on-surface truncate">
                  <span className="font-mono text-pokeball-red">[{tag || "???"}]</span>{" "}
                  {name || "—"}
                </div>
                {motto ? (
                  <p className="text-label-sm text-on-surface-variant italic truncate">
                    “{motto}”
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ClanAffinityChip
                    affinity={affinity}
                    label={labels.affinities[affinity]}
                    size="sm"
                  />
                  <span className="text-label-sm text-on-surface-variant">
                    {labels.focuses[focus]} · {labels.joinPolicies[joinPolicy]}
                  </span>
                </div>
              </div>
            </div>
            <p className="text-label-md text-on-surface-variant">{labels.createCost}</p>
          </div>
        )}
      </div>

      <div className="border-t border-white/5 px-4 py-3 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="min-h-11 px-4 rounded-lg border border-white/10 text-label-md text-on-surface-variant disabled:opacity-40"
        >
          {labels.back}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="min-h-11 px-4 rounded-lg bg-pokeball-red text-white text-label-md"
          >
            {labels.next}
          </button>
        ) : (
          <SubmitButton
            label={canAfford ? labels.createButton : labels.noFunds}
            pendingLabel={labels.creating}
            disabled={!canAfford || name.length < CLAN_NAME_MIN || tag.length < CLAN_TAG_MIN}
            className="min-h-11 text-label-md px-4 rounded-lg bg-pokeball-red text-white hover:bg-pokeball-red/80 transition-colors"
          />
        )}
      </div>
    </form>
  );
}

