"use client";

import { useEffect, useRef } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { useSessionStore } from "@/store/useSessionStore";
import { SessionPatch } from "@/lib/types/ap";

type RealtimePayload = {
  senderId: string;
  patch: SessionPatch;
};

export function useSessionRealtime(sessionId: string) {
  const lastMutation = useSessionStore((state) => state.lastMutation);
  const applyRemotePatch = useSessionStore((state) => state.applyRemotePatch);

  const senderIdRef = useRef<string>(
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)
  );

  const supabase = useRef(createBrowserSupabaseClient());
  const channelRef = useRef<ReturnType<typeof supabase.current.channel> | null>(null);
  const lastBroadcastRef = useRef<string | null>(null);

  useEffect(() => {
    const channel = supabase.current.channel(`session:${sessionId}`, {
      config: { broadcast: { self: false } },
    });

    channel.on(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      "broadcast" as any,
      { event: "session_update" },
      (payload: { payload?: RealtimePayload }) => {
        const data = payload.payload;
        if (!data || data.senderId === senderIdRef.current) return;
        applyRemotePatch(data.patch);
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      void supabase.current.removeChannel(channel);
      channelRef.current = null;
    };
  }, [applyRemotePatch, sessionId]);

  useEffect(() => {
    if (!lastMutation || !channelRef.current) return;

    const json = JSON.stringify(lastMutation);
    if (json === lastBroadcastRef.current) return;
    lastBroadcastRef.current = json;

    void channelRef.current.send({
      type: "broadcast",
      event: "session_update",
      payload: {
        senderId: senderIdRef.current,
        patch: lastMutation,
      } satisfies RealtimePayload,
    });
  }, [lastMutation]);
}
