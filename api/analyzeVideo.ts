import OpenAI from "openai";

export default async function handler(req: any, res: any) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada no Vercel" });

    const client = new OpenAI({ apiKey });

    const { platform, duration, hook, description } = req.body || {};

    const prompt = `
Você é especialista em vídeos virais para TikTok, Reels e Shorts.
Responda APENAS um JSON válido com:
score (0-100), strengths[], weaknesses[], improvements[], title, caption, cta.

Dados:
Plataforma: ${platform ?? "Todas"}
Duração: ${Number(duration ?? 0)}s
Gancho: ${String(hook ?? "")}
Descrição: ${String(description ?? "")}
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const text = completion.choices?.[0]?.message?.content?.trim() ?? "{}";

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { error: "A IA retornou formato inválido" };
    }

    return res.status(200).json(parsed);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || "Erro interno" });
  }
}
