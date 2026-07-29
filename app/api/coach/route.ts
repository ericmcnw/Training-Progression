import { createHash, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { COACH_TOOLS, runCoachTool } from "@/lib/coach-tools";
import { formatAppDate, todayAppYmd } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_PER_ROUND = 1500;
const MAX_TOOL_ROUNDS = 5;
const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 8000;

// The standing coaching brief ships in the repo so Eric can edit it like any
// other file. Read once per server instance.
let contextBriefPromise: Promise<string> | null = null;
function getContextBrief(): Promise<string> {
  contextBriefPromise ??= fs
    .readFile(path.join(process.cwd(), "docs", "ai-coach-context.md"), "utf8")
    .catch((err) => {
      contextBriefPromise = null; // don't cache the failure past a transient
      throw err;
    });
  return contextBriefPromise;
}

function secretMatches(provided: string, expected: string): boolean {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

type ChatMessage = { role: "user" | "assistant"; content: string };

function parseMessages(body: unknown): ChatMessage[] | null {
  if (!body || typeof body !== "object") return null;
  const raw = (body as { messages?: unknown }).messages;
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const { role, content } = entry as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || !content.trim() || content.length > MAX_MESSAGE_CHARS) return null;
    messages.push({ role, content });
  }
  if (messages[messages.length - 1].role !== "user") return null;
  return messages;
}

async function buildSystemPrompt(): Promise<string> {
  const brief = await getContextBrief();
  const todayLabel = formatAppDate(new Date(), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return [
    `You are Eric's training coach inside his progression-tracker app, on his phone.`,
    `Today is ${todayLabel} (${todayAppYmd()}), timezone America/New_York.`,
    ``,
    `Your standing coaching brief:`,
    ``,
    brief,
    ``,
    `## Working rules`,
    `- Before ANY training recommendation, call get_recent_logs and get_pain_trend`,
    `  (hamstring/knee zones matter most). Never advise blind; cite what the data`,
    `  actually shows ("MORNING readings this week: 2, 2, 3").`,
    `- get_schedule shows what's planned; check it before proposing a different day.`,
    `- get_routine_progress / get_exercise_history are the ground truth for loading`,
    `  trends (the single-leg curl progression especially) — use them for any`,
    `  "is it climbing / should I add weight" question instead of guessing.`,
    `- Phone-sized answers: lead with the recommendation, keep it tight, no`,
    `  headers unless genuinely needed. One clarifying question max, and only`,
    `  when the answer truly depends on it.`,
    `- If the tools return no data for a window, say so plainly rather than guessing.`,
  ].join("\n");
}

const encoder = new TextEncoder();

function event(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
}

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.COACH_SECRET;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!secret || !apiKey) {
    return Response.json({ error: "Coach is not configured on this deployment." }, { status: 503 });
  }

  const provided = request.headers.get("x-coach-key") ?? "";
  if (!provided || !secretMatches(provided, secret)) {
    return Response.json({ error: "Wrong coach passphrase." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const history = parseMessages(body);
  if (!history) {
    return Response.json({ error: "Invalid messages." }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });
  const system = await buildSystemPrompt();
  const conversation: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let currentStream: ReturnType<typeof client.messages.stream> | null = null;
      const onAbort = () => currentStream?.controller.abort();
      request.signal.addEventListener("abort", onAbort);

      try {
        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          currentStream = client.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS_PER_ROUND,
            system,
            messages: conversation,
            tools: COACH_TOOLS,
          });
          currentStream.on("text", (text: string) => controller.enqueue(event({ type: "text", text })));

          const message = await currentStream.finalMessage();
          conversation.push({ role: "assistant", content: message.content });

          const toolUses = message.content.filter(
            (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );
          if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;
          if (round === MAX_TOOL_ROUNDS) {
            controller.enqueue(event({ type: "text", text: "\n\n(Stopped: too many data lookups in one reply.)" }));
            break;
          }

          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const toolUse of toolUses) {
            controller.enqueue(event({ type: "tool", name: toolUse.name }));
            let result: string;
            try {
              result = await runCoachTool(toolUse.name, toolUse.input);
            } catch (err) {
              result = JSON.stringify({
                error: `Tool failed: ${err instanceof Error ? err.message : "unknown error"}`,
              });
            }
            results.push({ type: "tool_result", tool_use_id: toolUse.id, content: result });
          }
          conversation.push({ role: "user", content: results });
        }
        controller.enqueue(event({ type: "done" }));
      } catch (err) {
        if (!request.signal.aborted) {
          const message =
            err instanceof Anthropic.APIError
              ? `Coach request failed (${err.status ?? "network"}).`
              : "Coach request failed.";
          controller.enqueue(event({ type: "error", message }));
        }
      } finally {
        request.signal.removeEventListener("abort", onAbort);
        try {
          controller.close();
        } catch {
          // already closed by a cancelled consumer
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
