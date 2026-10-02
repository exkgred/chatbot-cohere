import { waitUntil } from "@vercel/functions";
import { CohereClient } from "cohere-ai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sanitizeVisitorName } from "../public/visitor-name.js";
import { normalizeLang } from "../public/i18n.js";
import { buildChatPrompt } from "./prompt.js";
import { hashOrigin, shipConversationLog } from "../lib/ship-log.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const knowledge = JSON.parse(
  readFileSync(join(__dirname, "../data/knowledge.json"), "utf-8")
);

// Monta o contexto completo uma única vez (sem embeddings)
const fullContext = knowledge.map((k) => k.content).join("\n\n");

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

function persistLog(payload) {
  const task = shipConversationLog(payload);
  waitUntil(task);
  return Promise.race([
    task,
    new Promise((resolve) => setTimeout(resolve, 6000)),
  ]);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, userName, sessionId, language } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const lang = normalizeLang(language);
  const visitorName = sanitizeVisitorName(userName);
  const startedAt = Date.now();
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    || req.socket.remoteAddress
    || "anon";

  if (req.body?.logOnly) {
    const reply = typeof req.body.reply === "string" ? req.body.reply : "";
    await shipConversationLog({
      timestamp: new Date().toISOString(),
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
      visitante: visitorName || null,
      pergunta: message,
      resposta: reply,
      latenciaMs: Date.now() - startedAt,
      modelo: "local",
      origemHash: hashOrigin(ip),
      source: "chatbot",
      language: lang,
    });
    return res.status(200).json({ ok: true });
  }

  try {
    const prompt = buildChatPrompt({
      lang,
      visitorName,
      message,
      fullContext,
    });

    const chatResponse = await cohere.chat({
      message: prompt,
      model: "command-a-03-2025",
      temperature: 0.4,
      maxTokens: 1000,
    });

    const reply = chatResponse.text;
    const logPayload = {
      timestamp: new Date().toISOString(),
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
      visitante: visitorName || null,
      pergunta: message,
      resposta: reply,
      latenciaMs: Date.now() - startedAt,
      modelo: "command-a-03-2025",
      origemHash: hashOrigin(ip),
      source: "chatbot",
      language: lang,
    };
    console.log(JSON.stringify(logPayload, null, 2));
    await persistLog(logPayload);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Erro na API:", error?.message || error);
    await persistLog({
      timestamp: new Date().toISOString(),
      sessionId: typeof sessionId === "string" ? sessionId : undefined,
      visitante: visitorName || null,
      pergunta: message,
      resposta: "",
      latenciaMs: Date.now() - startedAt,
      modelo: "command-a-03-2025",
      origemHash: hashOrigin(ip),
      erro: error?.message || "Internal server error",
      source: "chatbot",
      language: lang,
    });
    return res
      .status(500)
      .json({ error: "Internal server error", detail: error?.message });
  }
}
