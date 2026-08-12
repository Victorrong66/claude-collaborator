import Anthropic from "@anthropic-ai/sdk";

export interface ClaudeEngineCallbacks {
  onDelta: (text: string) => void;
  onDone: (fullText: string) => void;
  onError: (message: string) => void;
}

const MODEL = "claude-sonnet-5";

/**
 * Owns the single shared conversation with Claude. Only the host runs this
 * (the host's API key is the one powering the session) — the guest's
 * messages arrive over the relay and are fed in here just like the host's
 * own, so both participants are talking to one shared Claude.
 */
export class ClaudeEngine {
  private client: Anthropic;
  private history: Anthropic.MessageParam[] = [];
  private participantNames: [string, string];

  constructor(apiKey: string, hostName: string, guestName: string) {
    this.client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
    this.participantNames = [hostName, guestName];
  }

  private systemPrompt(): string {
    const [host, guest] = this.participantNames;
    return (
      `You are Claude, pairing in real time with two people sharing one ` +
      `terminal-style session: ${host} and ${guest}. Every user turn is ` +
      `prefixed with "[Name]:" so you know who is speaking. Address people ` +
      `by name when it's helpful, and treat this as one shared conversation ` +
      `both of them are watching live, not two separate chats.`
    );
  }

  async sendTurn(
    speakerName: string,
    text: string,
    cb: ClaudeEngineCallbacks,
  ): Promise<void> {
    this.history.push({ role: "user", content: `[${speakerName}]: ${text}` });

    let full = "";
    try {
      const stream = this.client.messages.stream({
        model: MODEL,
        max_tokens: 2048,
        system: this.systemPrompt(),
        messages: this.history,
      });

      stream.on("text", (delta) => {
        full += delta;
        cb.onDelta(delta);
      });

      await stream.finalMessage();
      this.history.push({ role: "assistant", content: full });
      cb.onDone(full);
    } catch (err) {
      // Roll back the user turn so a failed request doesn't poison history.
      this.history.pop();
      cb.onError(err instanceof Error ? err.message : String(err));
    }
  }
}
