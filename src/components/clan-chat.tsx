"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  listClanMessages,
  sendClanMessage,
  type ClanChatMessage,
} from "@/actions/clan-chat";

/**
 * Chat interno del clan.
 *
 * Se refresca por polling cada 5s en vez de websockets: el dossier pedía
 * Socket.io, pero eso necesita un proceso propio que el App Router no
 * mantiene (ver nota en el README de la fase). Para el caudal de un chat de
 * clan, un GET cada 5 segundos alcanza y no agrega infraestructura.
 */
const POLL_MS = 5000;

export function ClanChat({
  locale,
  clanId,
  currentUserId,
  initialMessages,
}: {
  locale: string;
  clanId: string;
  currentUserId: string;
  initialMessages: ClanChatMessage[];
}) {
  const t = useTranslations("clans");
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const lastIdRef = useRef(initialMessages.at(-1)?.id ?? null);

  useEffect(() => {
    let cancelled = false;
    const id = setInterval(async () => {
      const fresh = await listClanMessages(clanId);
      if (cancelled) return;
      const lastId = fresh.at(-1)?.id ?? null;
      // Sólo re-renderiza si cambió algo: evita pisar el scroll en cada tick.
      if (lastId !== lastIdRef.current) {
        lastIdRef.current = lastId;
        setMessages(fresh);
      }
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [clanId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  function send() {
    const text = draft.trim();
    if (!text || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await sendClanMessage(locale, clanId, text);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft("");
      const fresh = await listClanMessages(clanId);
      lastIdRef.current = fresh.at(-1)?.id ?? null;
      setMessages(fresh);
    });
  }

  return (
    <section className="glass-panel p-4">
      <h2 className="mb-3 flex items-center gap-2 border-b border-white/10 pb-2 text-headline-md text-white">
        <span className="material-symbols-outlined text-[20px]! text-pokeball-red">forum</span>
        {t("chatTitle")}
      </h2>

      <div className="flex max-h-72 min-h-[8rem] flex-col gap-2 overflow-y-auto pr-1">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-label-sm text-on-surface-variant">
            {t("chatEmpty")}
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.userId === currentUserId;
            return (
              <div
                key={m.id}
                className={`flex flex-col ${mine ? "items-end" : "items-start"}`}
              >
                <span className="text-[10px] text-on-surface-variant">
                  {mine ? t("chatYou") : m.userName}
                </span>
                <p
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-2.5 py-1.5 text-label-md ${
                    mine
                      ? "bg-pokeball-red/15 text-on-surface"
                      : "bg-white/[0.04] text-on-surface"
                  }`}
                >
                  {m.body}
                </p>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          maxLength={300}
          placeholder={t("chatPlaceholder")}
          className="h-10 flex-1 rounded-lg border border-white/10 bg-black/25 px-3 text-label-md text-on-surface placeholder:text-on-surface-variant/50 focus:border-pokeball-red/50 focus:outline-none"
        />
        <button
          type="button"
          onClick={send}
          disabled={pending || !draft.trim()}
          className="ui-btn-primary h-10 w-10"
          aria-label={t("chatSend")}
        >
          <span className="material-symbols-outlined text-[18px]!">send</span>
        </button>
      </div>

      {error && <p className="mt-1.5 text-label-sm text-error">{t(`chatErrors.${error}`)}</p>}
    </section>
  );
}
