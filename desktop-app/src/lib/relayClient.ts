import type { AppMessage, Role } from "./protocol";

type ServerMessage =
  | { type: "hosted"; code: string }
  | { type: "joined"; hostName: string }
  | { type: "peer-joined"; name: string }
  | { type: "peer-left" }
  | { type: "error"; message: string }
  | AppMessage;

export interface RelayEvents {
  hosted: (code: string) => void;
  joined: (hostName: string) => void;
  "peer-joined": (name: string) => void;
  "peer-left": () => void;
  error: (message: string) => void;
  message: (msg: AppMessage) => void;
  open: () => void;
  close: () => void;
}

/** Thin typed wrapper around a WebSocket connection to the relay.
 *  The relay is a dumb pipe: this client only speaks the app protocol. */
export class RelayClient {
  private ws: WebSocket | null = null;
  private listeners: { [K in keyof RelayEvents]?: RelayEvents[K][] } = {};
  role: Role | null = null;

  on<K extends keyof RelayEvents>(event: K, cb: RelayEvents[K]): () => void {
    const listeners = this.listeners as Record<string, unknown[]>;
    const arr = (listeners[event] ??= []);
    arr.push(cb);
    return () => {
      listeners[event] = arr.filter((fn) => fn !== cb);
    };
  }

  private emit<K extends keyof RelayEvents>(
    event: K,
    ...args: Parameters<RelayEvents[K]>
  ) {
    const listeners = this.listeners as Record<string, unknown[]>;
    for (const cb of listeners[event] ?? []) {
      (cb as (...a: Parameters<RelayEvents[K]>) => void)(...args);
    }
  }

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;
      ws.onopen = () => {
        this.emit("open");
        resolve();
      };
      ws.onerror = () => reject(new Error(`could not connect to ${url}`));
      ws.onclose = () => this.emit("close");
      ws.onmessage = (ev) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        switch (msg.type) {
          case "hosted":
            this.role = "host";
            this.emit("hosted", msg.code);
            break;
          case "joined":
            this.role = "guest";
            this.emit("joined", msg.hostName);
            break;
          case "peer-joined":
            this.emit("peer-joined", msg.name);
            break;
          case "peer-left":
            this.emit("peer-left");
            break;
          case "error":
            this.emit("error", msg.message);
            break;
          default:
            this.emit("message", msg as AppMessage);
        }
      };
    });
  }

  private raw(payload: Record<string, unknown>) {
    this.ws?.send(JSON.stringify(payload));
  }

  host(name: string) {
    this.raw({ type: "host", name });
  }

  join(code: string, name: string) {
    this.raw({ type: "join", code, name });
  }

  send(msg: AppMessage) {
    this.raw(msg);
  }

  close() {
    this.ws?.close();
    this.ws = null;
  }
}
