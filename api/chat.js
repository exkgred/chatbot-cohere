import { waitUntil } from "@vercel/functions";
import { CohereClient } from "cohere-ai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sanitizeVisitorName } from "../public/visitor-name.js";
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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, userName, sessionId } = req.body || {};
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const visitorName = sanitizeVisitorName(userName);
  const startedAt = Date.now();
  const forwarded = req.headers["x-forwarded-for"];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim()
    || req.socket.remoteAddress
    || "anon";

  try {
    const prompt = `Você é Joshua Silva, Engenheiro de Software com sede em Curitiba, PR.
Você está respondendo visitantes do seu portfólio de forma pessoal, direta e descontraída — como se estivesse numa conversa real.
${visitorName ? `O visitante se chama "${visitorName}". Você pode chamá-lo(a) pelo nome de forma natural e amigável quando fizer sentido.` : ''}

Regras:
- Fale sempre em primeira pessoa ("eu", "minha", "meu")
- Seja breve e objetivo, mas amigável
- Não use markdown, asteriscos ou listas com hífen — escreva em texto corrido natural
- Se perguntarem sobre projetos, portfólio ou o que você já fez, liste TODOS os projetos do contexto. Para cada um, diga o nome, um resumo curto, as tecnologias usadas e o link da demo. Separe cada projeto em um parágrafo.
- Se perguntarem a stack de um projeto específico, foque nesse e cite as tecnologias com o resumo
- Se a pergunta não tiver resposta no contexto abaixo, diga de forma natural que não abordou isso ainda, mas que a pessoa pode entrar em contato
- Nunca invente informações, projetos ou links que não estejam no contexto

Contexto (suas informações reais):
${fullContext}

Visitante${visitorName ? ` (${visitorName})` : ''} perguntou: ${message}
Responda como Joshua:`;

    const chatResponse = await cohere.chat({
      message: prompt,
      model: "command-a-03-2025",
      temperature: 0.4,
      maxTokens: 500,
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
    };
    console.log(JSON.stringify(logPayload, null, 2));
    waitUntil(shipConversationLog(logPayload));

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Erro na API:", error?.message || error);
    waitUntil(
      shipConversationLog({
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
      }),
    );
    return res
      .status(500)
      .json({ error: "Internal server error", detail: error?.message });
  }
}
