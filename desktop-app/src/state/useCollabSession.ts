import { useCallback, useEffect, useRef, useState } from "react";
import { RelayClient } from "../lib/relayClient";
import { ClaudeEngine } from "../lib/claudeEngine";
import type { AppMessage, Role, TranscriptEntry } from "../lib/protocol";

export type Phase = "landing" | "connecting" | "active";

export interface CollabState {
  phase: Phase;
  role: Role | null;
  myName: string;
  peerName: string;
  sessionCode: string | null;
  peerConnected: boolean;
  connectionError: string | null;
  transcript: TranscriptEntry[];
  peerTyping: string;
  claudeBusy: boolean;
}

const initialState: CollabState = {
  phase: "landing",
  role: null,
  myName: "",
  peerName: "",
  sessionCode: null,
  peerConnected: false,
  connectionError: null,
  transcript: [],
  peerTyping: "",
  claudeBusy: false,
};

function newId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function useCollabSession() {
  const [state, setState] = useState<CollabState>(initialState);
  const relay = useRef<RelayClient>(new RelayClient());
  const engine = useRef<ClaudeEngine | null>(null);
  const claudeEntryId = useRef<string | null>(null);

  const patch = (p: Partial<CollabState>) =>
    setState((s) => ({ ...s, ...p }));

  const addEntry = (entry: TranscriptEntry) =>
    setState((s) => ({ ...s, transcript: [...s.transcript, entry] }));

  const appendClaudeDelta = (delta: string) => {
    setState((s) => {
      if (!claudeEntryId.current) return s;
      return {
        ...s,
        transcript: s.transcript.map((e) =>
          e.id === claudeEntryId.current ? { ...e, text: e.text + delta } : e,
        ),
      };
    });
  };

  const finishClaude = () => {
    claudeEntryId.current = null;
    patch({ claudeBusy: false });
  };

  /** Only ever called on the host side: runs the shared Claude turn and
   *  mirrors the streamed reply to the guest over the relay. */
  const runClaudeTurn = useCallback((speakerName: string, text: string) => {
    if (!engine.current) return;
    const id = newId();
    claudeEntryId.current = id;
    patch({ claudeBusy: true });
    addEntry({ id, speaker: "claude", name: "Claude", text: "", streaming: true });
    relay.current.send({ type: "claude-start" });

    engine.current.sendTurn(speakerName, text, {
      onDelta: (delta) => {
        appendClaudeDelta(delta);
        relay.current.send({ type: "claude-delta", text: delta });
      },
      onDone: () => {
        setState((s) => ({
          ...s,
          transcript: s.transcript.map((e) =>
            e.id === id ? { ...e, streaming: false } : e,
          ),
        }));
        relay.current.send({ type: "claude-end" });
        finishClaude();
      },
      onError: (message) => {
        setState((s) => ({
          ...s,
          transcript: s.transcript.map((e) =>
            e.id === id
              ? { ...e, text: `(error: ${message})`, streaming: false }
              : e,
          ),
        }));
        relay.current.send({ type: "claude-error", message });
        finishClaude();
      },
    });
  }, []);

  useEffect(() => {
    const r = relay.current;
    const offs = [
      r.on("peer-joined", (name) => patch({ peerConnected: true, peerName: name })),
      r.on("peer-left", () =>
        patch({ peerConnected: false, connectionError: "The other person disconnected." }),
      ),
      r.on("error", (message) => patch({ connectionError: message })),
      r.on("close", () => patch({ peerConnected: false })),
      r.on("message", (msg: AppMessage) => {
        switch (msg.type) {
          case "chat": {
            addEntry({
              id: newId(),
              speaker: msg.role === "host" ? "host" : "guest",
              name: msg.name,
              text: msg.text,
            });
            if (state.role === "host") runClaudeTurn(msg.name, msg.text);
            break;
          }
          case "typing":
            patch({ peerTyping: msg.text });
            break;
          case "claude-start": {
            const id = newId();
            claudeEntryId.current = id;
            patch({ claudeBusy: true });
            addEntry({ id, speaker: "claude", name: "Claude", text: "", streaming: true });
            break;
          }
          case "claude-delta":
            appendClaudeDelta(msg.text);
            break;
          case "claude-end":
            setState((s) => ({
              ...s,
              transcript: s.transcript.map((e) =>
                e.id === claudeEntryId.current ? { ...e, streaming: false } : e,
              ),
            }));
            finishClaude();
            break;
          case "claude-error":
            finishClaude();
            break;
        }
      }),
    ];
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.role, runClaudeTurn]);

  const hostSession = useCallback(
    async (relayUrl: string, name: string, apiKey: string) => {
      patch({ phase: "connecting", myName: name, connectionError: null });
      try {
        await relay.current.connect(relayUrl);
        relay.current.on("hosted", (code) => {
          engine.current = new ClaudeEngine(apiKey, name, "the other person");
          patch({ phase: "active", sessionCode: code, role: "host" });
        });
        relay.current.host(name);
      } catch (err) {
        patch({
          phase: "landing",
          connectionError: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [],
  );

  const joinSession = useCallback(
    async (relayUrl: string, code: string, name: string) => {
      patch({ phase: "connecting", myName: name, connectionError: null });
      try {
        await relay.current.connect(relayUrl);
        relay.current.on("joined", (hostName) => {
          patch({ phase: "active", role: "guest", peerName: hostName, peerConnected: true });
        });
        relay.current.join(code, name);
      } catch (err) {
        patch({
          phase: "landing",
          connectionError: err instanceof Error ? err.message : String(err),
        });
      }
    },
    [],
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      addEntry({
        id: newId(),
        speaker: state.role === "host" ? "host" : "guest",
        name: state.myName,
        text,
      });
      relay.current.send({ type: "chat", name: state.myName, text });
      if (state.role === "host") runClaudeTurn(state.myName, text);
    },
    [state.role, state.myName, runClaudeTurn],
  );

  const sendTyping = useCallback((text: string) => {
    relay.current.send({ type: "typing", text });
  }, []);

  return { state, hostSession, joinSession, sendMessage, sendTyping };
}
