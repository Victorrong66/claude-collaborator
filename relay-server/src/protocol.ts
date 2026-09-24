/**
 * Shared wire protocol for the relay. The relay itself is deliberately dumb:
 * it only understands session/room management (host/join/presence) and
 * otherwise relays every other message verbatim to the other peer in the
 * room, stamping `role` so a guest can't spoof being the host.
 */

export type Role = "host" | "guest";

export interface HostMsg {
  type: "host";
  name: string;
}

export interface JoinMsg {
  type: "join";
  code: string;
  name: string;
}

export interface HostedMsg {
  type: "hosted";
  code: string;
}

export interface JoinedMsg {
  type: "joined";
  hostName: string;
}

export interface PeerJoinedMsg {
  type: "peer-joined";
  name: string;
}

export interface PeerLeftMsg {
  type: "peer-left";
}

export interface ErrorMsg {
  type: "error";
  message: string;
}

/** Anything else is app-level payload (chat, typing, claude-delta, ...)
 *  and is relayed verbatim to the other peer, with `role` overwritten
 *  to the sender's actual role before forwarding. */
export interface RelayedMsg {
  type: string;
  role?: Role;
  [key: string]: unknown;
}

export type ClientToServer = HostMsg | JoinMsg | RelayedMsg;
export type ServerToClient =
  | HostedMsg
  | JoinedMsg
  | PeerJoinedMsg
  | PeerLeftMsg
  | ErrorMsg
  | RelayedMsg;
