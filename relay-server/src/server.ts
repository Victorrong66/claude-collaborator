import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import type { ClientToServer, Role } from "./protocol.js";

const PORT = Number(process.env.PORT ?? 8787);
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
const CODE_LENGTH = 6;

interface Room {
  code: string;
  hostName: string;
  host: WebSocket;
  guest?: WebSocket;
  guestName?: string;
}

interface ConnState {
  role?: Role;
  roomCode?: string;
}

const rooms = new Map<string, Room>();
const state = new WeakMap<WebSocket, ConnState>();

function randomCode(): string {
  let code: string;
  do {
    code = Array.from(
      { length: CODE_LENGTH },
      () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)],
    ).join("");
  } while (rooms.has(code));
  return code;
}

function send(ws: WebSocket, msg: Record<string, unknown>) {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function otherPeer(room: Room, self: WebSocket): WebSocket | undefined {
  return self === room.host ? room.guest : room.host;
}

function closeRoom(room: Room, notify: boolean) {
  rooms.delete(room.code);
  for (const peer of [room.host, room.guest]) {
    if (!peer) continue;
    if (notify) send(peer, { type: "peer-left" });
    state.delete(peer);
  }
}

const server = createServer((req, res) => {
  if (req.url === "/healthz") {
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("ok");
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  state.set(ws, {});

  ws.on("message", (raw) => {
    let msg: ClientToServer;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      send(ws, { type: "error", message: "invalid JSON" });
      return;
    }

    const st = state.get(ws)!;

    if (msg.type === "host") {
      if (st.roomCode) {
        send(ws, { type: "error", message: "already in a session" });
        return;
      }
      const code = randomCode();
      const hostName = String((msg as { name?: unknown }).name || "Host");
      const room: Room = { code, hostName, host: ws };
      rooms.set(code, room);
      st.role = "host";
      st.roomCode = code;
      send(ws, { type: "hosted", code });
      return;
    }

    if (msg.type === "join") {
      if (st.roomCode) {
        send(ws, { type: "error", message: "already in a session" });
        return;
      }
      const code = String((msg as { code?: unknown }).code || "").toUpperCase();
      const room = rooms.get(code);
      if (!room) {
        send(ws, { type: "error", message: "session not found" });
        return;
      }
      if (room.guest) {
        send(ws, { type: "error", message: "session already has two people" });
        return;
      }
      room.guest = ws;
      room.guestName = String((msg as { name?: unknown }).name || "Guest");
      st.role = "guest";
      st.roomCode = room.code;
      send(ws, { type: "joined", hostName: room.hostName });
      send(room.host, { type: "peer-joined", name: room.guestName });
      return;
    }

    // Anything else: relay verbatim to the other peer in the room.
    if (!st.roomCode || !st.role) {
      send(ws, { type: "error", message: "not in a session yet" });
      return;
    }
    const room = rooms.get(st.roomCode);
    if (!room) return;
    const peer = otherPeer(room, ws);
    if (!peer) return; // other side hasn't joined yet
    send(peer, { ...msg, role: st.role });
  });

  ws.on("close", () => {
    const st = state.get(ws);
    if (!st?.roomCode) return;
    const room = rooms.get(st.roomCode);
    if (room) closeRoom(room, true);
  });
});

server.listen(PORT, () => {
  console.log(`claude-collaborator relay listening on :${PORT}`);
});
