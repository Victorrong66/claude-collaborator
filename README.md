# Claude Collaborator

A desktop app, styled like a terminal, where two people share one live
session with a single Claude — a shared transcript both of you watch update
in real time, plus a compose pane for you and a live "what they're typing"
mirror of the other person.

## How it works

```
┌─────────────┐        WebSocket        ┌──────────────┐
│  Host app    │◄──────────────────────►│ Relay server │
│ (runs Claude)│                         │ (room-based) │
└─────────────┘                         └──────┬───────┘
                                                │ WebSocket
                                         ┌──────▼───────┐
                                         │  Guest app   │
                                         └──────────────┘
```

- **Relay server** (`relay-server/`) — a tiny WebSocket server. It only
  manages sessions (a host creates one and gets a 6-character code; a guest
  joins with that code) and relays every other message verbatim between the
  two of you. It never sees your Anthropic API key and doesn't talk to
  Claude itself.
- **Desktop app** (`desktop-app/`) — a [Tauri](https://tauri.app) app
  (React + TypeScript frontend). Whoever **hosts** a session provides their
  Anthropic API key and that app instance calls Claude directly, streaming
  the reply to both participants over the relay. Whoever **joins** just
  needs the relay address and the session code.

Both of you see the same shared transcript. Below it, a split view shows
your own compose box next to a live, read-only mirror of what the other
person is currently typing — like watching a cursor in a shared doc.

## Running it

### 1. Start the relay server

```sh
cd relay-server
npm install
npm run dev        # or: npm run build && npm start
```

By default it listens on `ws://localhost:8787`. Set `PORT` to change it.
For two people on different networks, deploy this somewhere reachable by
both (a small VPS, Fly.io, Render, etc.) — it's a single dependency-light
Node process.

### 2. Run the desktop app

```sh
cd desktop-app
npm install
npm run tauri dev   # opens the native app window
```

> Building/running the native Tauri window requires the usual Tauri Linux
> prerequisites (`libwebkit2gtk-4.1-dev`, `libgtk-3-dev`, etc. — see the
> [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/))
> on Linux; macOS and Windows need only their standard build tools. `npm
> run dev` alone runs just the frontend in a regular browser tab, which is
> enough for UI development.

One person picks **Host a session**, enters their Anthropic API key, and
gets a session code to share with the other person (over text, Slack,
whatever). The other person picks **Join a session** and enters the relay
address plus that code.

### 3. Build a distributable app

```sh
cd desktop-app
npm run tauri build
```

## Project layout

```
relay-server/    Node/TypeScript WebSocket relay (session rooms only)
desktop-app/     Tauri + React + TypeScript client
  src/lib/         relay client, wire protocol, Claude streaming engine
  src/state/       useCollabSession — all session/transcript state
  src/components/  LandingScreen (host/join), SessionScreen (split-pane UI)
```

## Notes / known limitations (v1)

- Only two participants per session (host + one guest).
- The host's machine and API key power the shared Claude — if the host's
  app closes, the session ends.
- No persistence: the transcript lives only in memory for the session.
- No reconnect-with-history yet — a dropped connection ends the session.

## Ideas for later

- **Two Claudes that talk to each other**, one per participant, coordinating
  autonomously — a different, more complex collaboration model than this
  app's shared-single-Claude session. Worth its own project.
