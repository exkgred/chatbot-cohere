import { CohereClient } from "cohere-ai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { sanitizeVisitorName } from "../public/visitor-name.js";

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

  const { message, userName } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const visitorName = sanitizeVisitorName(userName);

  try {
    const prompt = `Você é Joshua Silva, Engenheiro de Software com sede em Curitiba, PR.
Você está respondendo visitantes do seu portfólio de forma pessoal, direta e descontraída — como se estivesse numa conversa real.
${visitorName ? `O visitante se chama "${visitorName}". Você pode chamá-lo(a) pelo nome de forma natural e amigável quando fizer sentido.` : ''}

Regras:
- Fale sempre em primeira pessoa ("eu", "minha", "meu")
- Seja breve e objetivo, mas amigável
- Não use markdown, asteriscos ou listas — escreva em texto corrido natural
- Se a pergunta não tiver resposta no contexto abaixo, diga de forma natural que não abordou isso ainda, mas que a pessoa pode entrar em contato
- Nunca invente informações que não estejam no contexto

Contexto (suas informações reais):
${fullContext}

Visitante${visitorName ? ` (${visitorName})` : ''} perguntou: ${message}
Responda como Joshua:`;

    const chatResponse = await cohere.chat({
      message: prompt,
      model: "command-a-03-2025",
      temperature: 0.4,
      maxTokens: 350,
    });

    const reply = chatResponse.text;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anônimo";
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      visitante: visitorName || "Não informado",
      origem_ip: ip,
      pergunta: message,
      resposta: reply
    }, null, 2));

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Erro na API:", error?.message || error);
    return res
      .status(500)
      .json({ error: "Internal server error", detail: error?.message });
  }
}
