"use client";

import { useEffect, useState } from "react";
import {
  FRIENDS_RAIL_PREF_EVENT,
  readFriendsRailVisible,
} from "@/lib/friends-rail-pref";

/** Preferencia de la columna: default on, se alinea a sessionStorage tras el primer frame. */
export function useFriendsRailVisible(): boolean {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setVisible(readFriendsRailVisible());
    });
    function sync() {
      setVisible(readFriendsRailVisible());
    }
    window.addEventListener(FRIENDS_RAIL_PREF_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(FRIENDS_RAIL_PREF_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return visible;
}
