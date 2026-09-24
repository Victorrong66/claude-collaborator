import { useState } from "react";

const DEFAULT_RELAY = "ws://localhost:8787";

interface Props {
  connectionError: string | null;
  onHost: (relayUrl: string, name: string, apiKey: string) => void;
  onJoin: (relayUrl: string, code: string, name: string) => void;
}

export function LandingScreen({ connectionError, onHost, onJoin }: Props) {
  const [mode, setMode] = useState<"choose" | "host" | "join">("choose");
  const [relayUrl, setRelayUrl] = useState(DEFAULT_RELAY);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [code, setCode] = useState("");

  return (
    <div className="screen landing">
      <pre className="ascii-title">{String.raw`
   ____ _                 _        ____      _ _       _
  / ___| | __ _ _   _  __| | ___  / ___|___ | | | __ _| |__
 | |   | |/ _\` | | | |/ _\` |/ _ \| |   / _ \| | |/ _\` | '_ \
 | |___| | (_| | |_| | (_| |  __/| |__| (_) | | | (_| | |_) |
  \____|_|\__,_|\__,_|\__,_|\___(_)____\___/|_|_|\__,_|_.__/
`}</pre>

      {mode === "choose" && (
        <div className="stack">
          <button className="btn primary" onClick={() => setMode("host")}>
            Host a session
          </button>
          <button className="btn" onClick={() => setMode("join")}>
            Join a session
          </button>
        </div>
      )}

      {mode === "host" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            onHost(relayUrl, name.trim() || "Host", apiKey.trim());
          }}
        >
          <label>
            Relay server address
            <input value={relayUrl} onChange={(e) => setRelayUrl(e.target.value)} />
          </label>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alice" />
          </label>
          <label>
            Anthropic API key
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
              required
            />
          </label>
          <p className="hint">
            Your key stays on this machine and is used only to call the Anthropic API directly.
            It's never sent to the relay server.
          </p>
          <div className="row">
            <button type="button" className="btn" onClick={() => setMode("choose")}>
              Back
            </button>
            <button type="submit" className="btn primary">
              Start session
            </button>
          </div>
        </form>
      )}

      {mode === "join" && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            onJoin(relayUrl, code.trim(), name.trim() || "Guest");
          }}
        >
          <label>
            Relay server address
            <input value={relayUrl} onChange={(e) => setRelayUrl(e.target.value)} />
          </label>
          <label>
            Your name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bob" />
          </label>
          <label>
            Session code
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              required
            />
          </label>
          <div className="row">
            <button type="button" className="btn" onClick={() => setMode("choose")}>
              Back
            </button>
            <button type="submit" className="btn primary">
              Join session
            </button>
          </div>
        </form>
      )}

      {connectionError && <p className="error">{connectionError}</p>}
    </div>
  );
}
