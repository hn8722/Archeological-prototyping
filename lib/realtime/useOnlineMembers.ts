"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Supabase Presence を使ってセッションのオンラインメンバー数を追跡するフック。
 * 同じセッションを開いているタブ・ユーザーの人数をリアルタイムで返す。
 */
export function useOnlineMembers(sessionId: string): number {
  const [count, setCount] = useState(1);
  const supabase = useRef(createBrowserSupabaseClient());

  useEffect(() => {
    const presenceKey = typeof crypto !== "undefined"
      ? crypto.randomUUID()
      : Math.random().toString(36);

    const channel = supabase.current.channel(`presence:${sessionId}`, {
      config: { presence: { key: presenceKey } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      setCount(Object.keys(state).length);
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ sessionId, joinedAt: Date.now() });
      }
    });

    return () => {
      void supabase.current.removeChannel(channel);
    };
  }, [sessionId]);

  return count;
}
