"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Avatar optimista compartido entre el picker del perfil y el menú del header.
 *
 * El perfil ya pintaba el cambio al confirmar; el header vive en el layout y
 * sólo se enteraba cuando terminaba `revalidatePath(..., "layout")`. Este
 * contexto acerca ese feedback al menú sin esperar al RSC.
 *
 * Se guarda el `userKey` (id de sesión) para no filtrar el override a otra
 * cuenta si la sesión cambia antes de que el provider se desmonte.
 */
type Pending = {
  avatarId: string;
  userKey: string;
};

type OptimisticAvatarContextValue = {
  pending: Pending | null;
  /** Pasar `null` limpia el override (p. ej. al revertir un guardado fallido). */
  setOptimisticAvatarId: (avatarId: string | null, userKey: string) => void;
};

const OptimisticAvatarContext =
  createContext<OptimisticAvatarContextValue | null>(null);

export function OptimisticAvatarProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const setOptimisticAvatarId = useCallback(
    (avatarId: string | null, userKey: string) => {
      if (avatarId == null || !userKey) {
        setPending(null);
        return;
      }
      setPending({ avatarId, userKey });
    },
    [],
  );

  const value = useMemo(
    () => ({ pending, setOptimisticAvatarId }),
    [pending, setOptimisticAvatarId],
  );

  return (
    <OptimisticAvatarContext.Provider value={value}>
      {children}
    </OptimisticAvatarContext.Provider>
  );
}

function useOptimisticAvatarContext(): OptimisticAvatarContextValue {
  const ctx = useContext(OptimisticAvatarContext);
  if (!ctx) {
    return {
      pending: null,
      setOptimisticAvatarId: () => {},
    };
  }
  return ctx;
}

/** Id a pintar: override mientras el layout no revalidó; si no, el del server. */
export function useOptimisticAvatarId(
  serverId: string | null,
  userKey: string | null | undefined,
): string | null {
  const { pending } = useOptimisticAvatarContext();
  if (
    pending &&
    userKey &&
    pending.userKey === userKey &&
    pending.avatarId !== serverId
  ) {
    return pending.avatarId;
  }
  return serverId;
}

export function useSetOptimisticAvatarId() {
  return useOptimisticAvatarContext().setOptimisticAvatarId;
}
