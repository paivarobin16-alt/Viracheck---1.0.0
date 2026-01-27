import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req: any, res: any) {
  try {
    // CORS (geralmente não precisa no mesmo domínio, mas deixo seguro)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

    if (req.method === "OPTIONS") return res.status(200).send("");
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const { platform, duration, hook, description } = req.body || {};

    const prompt = `
Você é um especialista em vídeos virais para TikTok, Instagram Reels e YouTube Shorts.
Responda APENAS com um JSON válido (sem texto fora do JSON).

DADOS:
- Plataforma: ${platform ?? "Todas"}
- Duração: ${Number(duration ?? 0)} segundos
- Gancho: ${String(hook ?? "")}
- Descrição: ${String(description ?? "")}

FORMATO:
{
  "score": 0,
  "strengths": [],
  "weaknesses": [],
  "improvements": [],
  "title": "",
  "caption": "",
  "cta": ""
}

Regras:
- Português do Brasil
- Direto e prático
- Score de 0 a 100
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "";

    // Tenta garantir JSON válido
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = {
        score: 50,
        strengths: ["Não consegui interpretar a saída como JSON."],
        weaknesses: ["A resposta da IA veio fora do formato esperado."],
        improvements: ["Tente novamente com mais detalhes do vídeo."],
        title: "Sugestão de título",
        caption: "Sugestão de legenda",
        cta: "Sugestão de CTA",
      };
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}

