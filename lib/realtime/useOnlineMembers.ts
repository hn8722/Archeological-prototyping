"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { SelectedTarget } from "@/lib/types/ap";

export type OnlineMember = {
  key: string;
  displayName: string;
  color: string;
  selectedTarget: SelectedTarget;
  joinedAt: number;
  updatedAt: number;
};

type PresencePayload = {
  sessionId: string;
  displayName?: string;
  color?: string;
  selectedTarget?: SelectedTarget;
  joinedAt?: number;
  updatedAt?: number;
};

function getMemberColor(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 360;
  }

  return `hsl(${hash} 62% 52%)`;
}

export function useOnlineMembers(
  sessionId: string,
  selectedTarget: SelectedTarget = null,
  displayName = "参加者",
  enabled = true
): { count: number; members: OnlineMember[]; peers: OnlineMember[] } {
  const [members, setMembers] = useState<OnlineMember[]>([]);
  const supabase = useRef(createBrowserSupabaseClient());
  const channelRef = useRef<ReturnType<typeof supabase.current.channel> | null>(null);
  const presenceKeyRef = useRef<string>(
    typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36)
  );
  const joinedAtRef = useRef(Date.now());
  const colorRef = useRef(getMemberColor(presenceKeyRef.current));

  useEffect(() => {
    if (!enabled) {
      setMembers([]);
      return;
    }

    const channel = supabase.current.channel(`presence:${sessionId}`, {
      config: { presence: { key: presenceKeyRef.current } },
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const nextMembers = Object.entries(state).flatMap<OnlineMember>(([key, presences]) => {
        const latest = (presences as unknown as PresencePayload[]).at(-1);
        if (!latest) return [];

        return [{
          key,
          displayName: latest.displayName?.trim() || "参加者",
          color: latest.color || getMemberColor(key),
          selectedTarget: latest.selectedTarget ?? null,
          joinedAt: latest.joinedAt ?? Date.now(),
          updatedAt: latest.updatedAt ?? Date.now(),
        }];
      });

      setMembers(nextMembers.sort((first, second) => first.joinedAt - second.joinedAt));
    });

    channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({
          sessionId,
          displayName,
          color: colorRef.current,
          selectedTarget,
          joinedAt: joinedAtRef.current,
          updatedAt: Date.now(),
        } satisfies PresencePayload);
      }
    });

    channelRef.current = channel;

    return () => {
      void supabase.current.removeChannel(channel);
      channelRef.current = null;
    };
  }, [displayName, enabled, sessionId]);

  useEffect(() => {
    if (!enabled || !channelRef.current) return;

    void channelRef.current.track({
      sessionId,
      displayName,
      color: colorRef.current,
      selectedTarget,
      joinedAt: joinedAtRef.current,
      updatedAt: Date.now(),
    } satisfies PresencePayload);
  }, [displayName, enabled, selectedTarget, sessionId]);

  const peers = members.filter((member) => member.key !== presenceKeyRef.current);

  return {
    count: members.length || 1,
    members,
    peers,
  };
}
