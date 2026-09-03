import { CohereClient } from "cohere-ai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const knowledge = JSON.parse(
  readFileSync(join(__dirname, "../data/knowledge.json"), "utf-8")
);

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    // 1. Embedding da pergunta
    const embedResponse = await cohere.embed({
      texts: [message],
      model: "embed-multilingual-v3.0",
      inputType: "search_query",
    });
    const questionEmbedding = embedResponse.embeddings[0];

    // 2. Calcula similaridade com cada seção
    const scoredSections = [];
    for (const item of knowledge) {
      const sectionEmbed = await cohere.embed({
        texts: [item.content],
        model: "embed-multilingual-v3.0",
        inputType: "search_document",
      });
      const similarity = cosineSimilarity(
        questionEmbedding,
        sectionEmbed.embeddings[0]
      );
      scoredSections.push({ ...item, similarity });
    }

    // 3. Seleciona as 3 seções mais relevantes
    const topSections = scoredSections
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 3)
      .map((s) => s.content)
      .join("\n\n");

    // 4. Prompt com contexto
    const prompt = `Você é um assistente virtual do portfólio de Joshua Silva, Engenheiro de Software.
Responda de forma clara e amigável, APENAS com base no contexto fornecido abaixo.
Se a informação não estiver no contexto, diga: "Não encontrei essa informação no meu portfólio."

Contexto:
${topSections}

Pergunta: ${message}`;

    // 5. Chamada ao chat da Cohere
    const chatResponse = await cohere.chat({
      message: prompt,
      model: "command-r",
      temperature: 0.3,
    });

    return res.status(200).json({ reply: chatResponse.text });
  } catch (error) {
    console.error("Erro na API:", error?.message || error);
    return res.status(500).json({ error: "Internal server error", detail: error?.message });
  }
}

function cosineSimilarity(vecA, vecB) {
  const dot = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));
  return dot / (magA * magB);
}
