import Anthropic from "@anthropic-ai/sdk";
import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

export const MODEL = "claude-opus-5-5";

export class ClaudeError extends Error {}

function client(apiKey: string) {
  if (!apiKey) throw new ClaudeError("Add your Anthropic API key in Settings first.");
  // The key belongs to the user and lives only on their device (see Settings).
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
}

/**
 * One structured-output call. The system prompt is cached so repeated calls for the
 * same form (e.g. several correction rounds) are cheaper and faster.
 */
export async function structuredCall<T>(opts: {
  apiKey: string;
  system: string;
  content: BetaContentBlockParam[];
  schema: Record<string, unknown>;
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<T> {
  const c = client(opts.apiKey);
  let msg;
  try {
    msg = await c.beta.messages
      .stream({
        model: MODEL,
        max_tokens: opts.maxTokens ?? 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: {
          effort: opts.effort ?? "medium",
          format: { type: "json_schema", schema: opts.schema },
        },
        system: [{ type: "text", text: opts.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: opts.content }],
      })
      .finalMessage();
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) throw new ClaudeError("The Anthropic API key was rejected. Check it in Settings.");
    if (e instanceof Anthropic.RateLimitError) throw new ClaudeError("Rate limit reached — wait a minute and try again.");
    if (e instanceof Anthropic.APIConnectionError) throw new ClaudeError("No connection to Claude. Are you online?");
    if (e instanceof Anthropic.APIError) throw new ClaudeError(`Claude API error ${e.status ?? ""}: ${e.message}`);
    throw e;
  }
  if (msg.stop_reason === "refusal") throw new ClaudeError("Claude declined this request.");
  if (msg.stop_reason === "max_tokens") throw new ClaudeError("The answer was too long and got cut off. Try splitting the form.");
  const text = msg.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ClaudeError("Claude returned an unreadable answer. Please try again.");
  }
}

export function dataUrlToImageBlock(dataUrl: string): BetaContentBlockParam {
  const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.*)$/.exec(dataUrl);
  if (!m) throw new Error("Unsupported image format");
  return {
    type: "image",
    source: { type: "base64", media_type: m[1] as "image/jpeg" | "image/png", data: m[2] },
  };
}
