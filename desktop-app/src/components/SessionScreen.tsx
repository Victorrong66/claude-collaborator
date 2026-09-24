import { useEffect, useRef, useState } from "react";
import type { CollabState } from "../state/useCollabSession";

interface Props {
  state: CollabState;
  onSend: (text: string) => void;
  onTyping: (text: string) => void;
}

export function SessionScreen({ state, onSend, onTyping }: Props) {
  const [draft, setDraft] = useState("");
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [state.transcript]);

  const submit = () => {
    if (!draft.trim()) return;
    onSend(draft);
    setDraft("");
    onTyping("");
  };

  return (
    <div className="screen session">
      <header className="statusbar">
        <span className="badge role">{state.role}</span>
        {state.sessionCode && (
          <span className="badge code">
            code: <strong>{state.sessionCode}</strong>
          </span>
        )}
        <span className={`badge status ${state.peerConnected ? "on" : "off"}`}>
          {state.peerConnected
            ? `${state.peerName || "peer"} connected`
            : state.role === "host"
              ? "waiting for the other person to join…"
              : "connecting…"}
        </span>
        {state.claudeBusy && <span className="badge busy">Claude is thinking…</span>}
      </header>

      {state.connectionError && <p className="error">{state.connectionError}</p>}

      <div className="transcript" ref={transcriptRef}>
        {state.transcript.length === 0 && (
          <p className="empty">Say something below to start the conversation.</p>
        )}
        {state.transcript.map((entry) => (
          <div key={entry.id} className={`entry ${entry.speaker}`}>
            <span className="entry-name">{entry.name}</span>
            <span className="entry-text">
              {entry.text}
              {entry.streaming && <span className="cursor">▌</span>}
            </span>
          </div>
        ))}
      </div>

      <div className="panes">
        <div className="pane mine">
          <div className="pane-label">You ({state.myName})</div>
          <textarea
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onTyping(e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
          />
          <button className="btn primary" onClick={submit}>
            Send
          </button>
        </div>
        <div className="pane theirs">
          <div className="pane-label">{state.peerName || "Other participant"} (typing…)</div>
          <div className="mirror">{state.peerTyping || <span className="dim">—</span>}</div>
        </div>
      </div>
    </div>
  );
}
