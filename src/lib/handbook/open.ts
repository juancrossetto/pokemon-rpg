"use client";

import { useSyncExternalStore } from "react";
import {
  HANDBOOK_CHAPTERS,
  isHandbookChapter,
  type HandbookChapterId,
} from "@/lib/handbook/chapters";

type HandbookState = {
  open: boolean;
  chapter: HandbookChapterId;
};

const DEFAULT: HandbookState = {
  open: false,
  chapter: HANDBOOK_CHAPTERS[0],
};

let state: HandbookState = DEFAULT;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): HandbookState {
  return state;
}

function getServerSnapshot(): HandbookState {
  return DEFAULT;
}

/** Abre el manual; opcionalmente salta a un capítulo. */
export function openHandbook(chapter?: HandbookChapterId | string | null) {
  state = {
    open: true,
    chapter: isHandbookChapter(chapter) ? chapter : state.chapter,
  };
  emit();
}

export function closeHandbook() {
  if (!state.open) return;
  state = { ...state, open: false };
  emit();
}

export function setHandbookChapter(chapter: HandbookChapterId) {
  if (state.chapter === chapter) return;
  state = { ...state, chapter };
  emit();
}

export function useHandbookState(): HandbookState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
