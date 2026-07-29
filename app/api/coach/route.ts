import { createHash, timingSafeEqual } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";
import { COACH_TOOLS, runCoachTool } from "@/lib/coach-tools";
import { formatAppDate, todayAppYmd } from "@/lib/dates";

export const runtime = "nodejs";
export const maxDuration = 60;

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS_PER_ROUND = 1500;
const MAX_TOOL_ROUNDS = 5;
const MAX_MESSAGE_CHARS = 8000;
// Messages sent to the model verbatim; older ones live in the rolling summary.
const LIVE_WINDOW = 20;
// Regenerate the summary once at least this many messages have aged out of
// the window since the last summarization (avoids summarizing every turn).
const SUMMARIZE_BATCH = 10;
const SUMMARY_SOURCE_CHAR_CAP = 30_000;

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

function gate(request: Request): Response | null {
  const secret = process.env.COACH_SECRET;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!secret || !apiKey) {
    return Response.json({ error: "Coach is not configured on this deployment." }, { status: 503 });
  }
  const provided = request.headers.get("x-coach-key") ?? "";
  if (!provided || !secretMatches(provided, secret)) {
    return Response.json({ error: "Wrong coach passphrase." }, { status: 401 });
  }
  return null;
}

// The static prompt half is byte-stable across requests so the cache_control
// checkpoint on it (plus the tools before it) actually hits. Anything that
// varies per request or per day belongs in the dynamic half.
async function buildSystemBlocks(threadSummary: string | null): Promise<Anthropic.TextBlockParam[]> {
  const brief = await getContextBrief();
  const staticPart = [
    `You are Eric's training coach inside his progression-tracker app, on his phone.`,
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

  const todayLabel = formatAppDate(new Date(), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const dynamicPart = [
    `Today is ${todayLabel} (${todayAppYmd()}), timezone America/New_York.`,
    ...(threadSummary ? [``, `Summary of this conversation's earlier messages:`, threadSummary] : []),
  ].join("\n");

  return [
    { type: "text", text: staticPart, cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamicPart },
  ];
}

export async function GET(request: Request): Promise<Response> {
  const denied = gate(request);
  if (denied) return denied;

  const thread = await prisma.coachThread.findFirst({
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: -60 } },
  });
  return Response.json({
    threadId: thread?.id ?? null,
    messages: (thread?.messages ?? []).map((m) => ({ role: m.role, content: m.content })),
  });
}

const encoder = new TextEncoder();

function event(payload: Record<string, unknown>): Uint8Array {
  return encoder.encode(`${JSON.stringify(payload)}\n`);
}

async function maybeSummarize(client: Anthropic, threadId: string): Promise<void> {
  const thread = await prisma.coachThread.findUnique({
    where: { id: threadId },
    select: { summary: true, summarizedCount: true },
  });
  if (!thread) return;
  const count = await prisma.coachMessage.count({ where: { threadId } });
  const aged = count - LIVE_WINDOW;
  if (aged < thread.summarizedCount + SUMMARIZE_BATCH) return;

  const olderMessages = await prisma.coachMessage.findMany({
    where: { threadId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: aged,
    select: { role: true, content: true },
  });
  let source = olderMessages.map((m) => `${m.role === "user" ? "Eric" : "Coach"}: ${m.content}`).join("\n\n");
  if (source.length > SUMMARY_SOURCE_CHAR_CAP) source = source.slice(-SUMMARY_SOURCE_CHAR_CAP);

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    messages: [
      {
        role: "user",
        content: [
          `Compress this coaching-conversation history into a dense summary (under 300 words) a coach can rely on later: topics discussed, data cited (pain readings, loads, dates), recommendations made, decisions and plans. No preamble.`,
          ...(thread.summary ? [`\nPrevious summary (fold it in):\n${thread.summary}`] : []),
          `\nConversation:\n${source}`,
        ].join("\n"),
      },
    ],
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) return;
  await prisma.coachThread.update({
    where: { id: threadId },
    data: { summary: text, summarizedCount: aged },
  });
}

export async function POST(request: Request): Promise<Response> {
  const denied = gate(request);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  const { message, threadId } = (body ?? {}) as { message?: unknown; threadId?: unknown };
  if (typeof message !== "string" || !message.trim() || message.length > MAX_MESSAGE_CHARS) {
    return Response.json({ error: "Invalid message." }, { status: 400 });
  }
  if (threadId !== undefined && threadId !== null && typeof threadId !== "string") {
    return Response.json({ error: "Invalid threadId." }, { status: 400 });
  }
  const userText = message.trim();

  // Resolve the thread: explicit id continues it, "new" forces a fresh one,
  // absent continues the latest (or starts the first).
  let thread =
    typeof threadId === "string" && threadId !== "new"
      ? await prisma.coachThread.findUnique({ where: { id: threadId }, select: { id: true, summary: true } })
      : threadId === "new"
      ? null
      : await prisma.coachThread.findFirst({ orderBy: { updatedAt: "desc" }, select: { id: true, summary: true } });
  thread ??= await prisma.coachThread.create({
    data: { title: userText.slice(0, 80) },
    select: { id: true, summary: true },
  });

  const prior = await prisma.coachMessage.findMany({
    where: { threadId: thread.id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: -LIVE_WINDOW,
    select: { role: true, content: true },
  });
  while (prior.length && prior[0].role !== "user") prior.shift();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const system = await buildSystemBlocks(thread.summary);
  const conversation: Anthropic.MessageParam[] = [
    ...prior.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user", content: userText },
  ];

  const activeThreadId = thread.id;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let currentStream: ReturnType<typeof client.messages.stream> | null = null;
      const onAbort = () => currentStream?.controller.abort();
      request.signal.addEventListener("abort", onAbort);
      let assistantText = "";

      try {
        controller.enqueue(event({ type: "meta", threadId: activeThreadId }));

        for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
          currentStream = client.messages.stream({
            model: MODEL,
            max_tokens: MAX_TOKENS_PER_ROUND,
            system,
            messages: conversation,
            tools: COACH_TOOLS,
          });
          currentStream.on("text", (text: string) => {
            assistantText += text;
            controller.enqueue(event({ type: "text", text }));
          });

          const message = await currentStream.finalMessage();
          conversation.push({ role: "assistant", content: message.content });

          const toolUses = message.content.filter(
            (block: Anthropic.ContentBlock): block is Anthropic.ToolUseBlock => block.type === "tool_use"
          );
          if (message.stop_reason !== "tool_use" || toolUses.length === 0) break;
          if (round === MAX_TOOL_ROUNDS) {
            const note = "\n\n(Stopped: too many data lookups in one reply.)";
            assistantText += note;
            controller.enqueue(event({ type: "text", text: note }));
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

        // Persist the exchange only after a successful reply so a failed call
        // never strands a user message the client will resend anyway.
        if (assistantText.trim()) {
          // Explicit timestamps: a shared default(now()) ties the pair and
          // makes the createdAt ordering interleave user/assistant wrongly.
          const at = Date.now();
          await prisma.coachThread.update({
            where: { id: activeThreadId },
            data: {
              messages: {
                create: [
                  { role: "user", content: userText, createdAt: new Date(at) },
                  { role: "assistant", content: assistantText.trim(), createdAt: new Date(at + 1) },
                ],
              },
            },
          });
        }
        controller.enqueue(event({ type: "done" }));

        try {
          await maybeSummarize(client, activeThreadId);
        } catch {
          // Summarization is best-effort — never fail the reply over it.
        }
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
