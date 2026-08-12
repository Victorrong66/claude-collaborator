export type Role = "host" | "guest";

/** App-level messages relayed verbatim between host and guest.
 *  The relay server stamps `role` to the true sender's role. */
export type AppMessage =
  | { type: "chat"; role?: Role; name: string; text: string }
  | { type: "typing"; role?: Role; text: string }
  | { type: "claude-start"; role?: Role }
  | { type: "claude-delta"; role?: Role; text: string }
  | { type: "claude-end"; role?: Role }
  | { type: "claude-error"; role?: Role; message: string };

export interface TranscriptEntry {
  id: string;
  speaker: "host" | "guest" | "claude";
  name: string;
  text: string;
  streaming?: boolean;
}
