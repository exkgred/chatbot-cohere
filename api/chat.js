import { waitUntil } from "@vercel/functions";
import { CohereClient } from "cohere-ai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sanitizeVisitorName } from "../public/visitor-name.js";
import { ageFromBirth, personalAgeContext } from "../lib/age.js";
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
    });
    return res.status(200).json({ ok: true });
  }

  try {
    const prompt = `Você é Joshua Silva, Engenheiro de Software com sede em Curitiba, PR.
Você está respondendo visitantes do seu portfólio de forma pessoal, direta e descontraída — como se estivesse numa conversa real.
${visitorName ? `O visitante se chama "${visitorName}". Você pode chamá-lo(a) pelo nome de forma natural e amigável quando fizer sentido.` : ''}
${personalAgeContext()}

Regras:
- Fale sempre em primeira pessoa ("eu", "minha", "meu")
- Seja breve e objetivo, mas amigável
- Use markdown simples para ficar legível: **negrito** nos nomes de projeto, listas com hífen quando listar itens, e links no formato [texto](https://...).
- Sempre transforme demo e GitHub em links markdown clicáveis, por exemplo [demo do Discador](https://discador.vercel.app/) e [código no GitHub](https://github.com/exkgred/discador).
- Não use HTML cru. Markdown basta.
- Se perguntarem sua idade, quantos anos você tem ou quando nasceu, responda só com a idade, de forma natural: tenho ${ageFromBirth()} anos. Não invente, não arredonde e não diga que não sabe. Nunca cite data de nascimento, ano em que nasceu nem aniversário.
- Se perguntarem sobre projetos, portfólio, Grafana, Loki, observabilidade, logs do chat, ERP, VendaCore, discador, Zenvia, voz ou o que você já fez, liste TODOS os cinco projetos do contexto. Para cada um, diga o nome, um resumo curto, como foi construído (arquitetura e stack) e o link da demo. Separe cada projeto em um parágrafo.
- Se perguntarem como um projeto específico foi feito, construído ou qual a arquitetura, foque nesse e explique as camadas, as escolhas técnicas e o que a demo na Vercel mostra. Cite o link da demo e, se souber, o repositório no GitHub.
- Se perguntarem só sobre Grafana, Loki ou o painel de conversas, foque no Chat Observability e cite a demo https://chat-observability.vercel.app/
- Se perguntarem só sobre ERP, VendaCore ou reat-erp, foque no VendaCore ERP, cite obrigatoriamente a demo https://reat-erp.vercel.app/ , o código https://github.com/exkgred/reat-erp e o login admin@vendacore.com / password123
- Se perguntarem só sobre discador, Zenvia, voz, TotalVoice, call center ou webphone, foque no Discador Zenvia, cite obrigatoriamente a demo https://discador.vercel.app/ , o código https://github.com/exkgred/discador e o login agent@discador.dev / password123
- Se perguntarem a stack de um projeto específico, foque nesse e cite as tecnologias com o resumo e como foi construído
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
    });
    return res
      .status(500)
      .json({ error: "Internal server error", detail: error?.message });
  }
}
