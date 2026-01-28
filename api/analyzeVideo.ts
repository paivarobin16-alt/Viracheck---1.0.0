// ✅ PASSO 2: Chamada correta na Responses API com Structured Outputs (text.format)
// Docs: Structured Outputs via text.format exige `name` + `schema` + `type` :contentReference[oaicite:1]{index=1}

type ViracheckAnalysis = {
  resumo: string;
  nota_viralizacao: number; // 0..100
  pontos_fortes: string[];
  pontos_fracos: string[];
  sugestoes_melhoria: string[];
  ganchos_sugeridos: string[];
  hashtags_sugeridas: string[];
  recomendacoes_por_plataforma: {
    tiktok: string[];
    instagram: string[];
    youtube_shorts: string[];
    kwai: string[];
  };
};

export async function callOpenAIForAnalysis(params: {
  plataforma: "todas" | "tiktok" | "instagram" | "youtube_shorts" | "kwai";
  gancho?: string;
  descricao?: string;
  // Você pode passar aqui qualquer texto/metadata que você extraiu do vídeo
  // (ex: duração, tipo, falas, frames, etc.)
  contextoExtra?: string;
}): Promise<ViracheckAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const { plataforma, gancho, descricao, contextoExtra } = params;

  const system = `
Você é o Viracheck AI (PT-BR).
Responda APENAS no formato JSON do schema.
Se algum dado não existir, use string vazia "" ou lista vazia [].
A nota_viralizacao deve ser um número de 0 a 100.
`;

  const user = `
Analise este vídeo (com base nas informações fornecidas) e gere recomendações práticas.

Plataforma: ${plataforma}
Gancho (opcional): ${gancho ?? ""}
Descrição (opcional): ${descricao ?? ""}
Contexto extra (opcional): ${contextoExtra ?? ""}

Quero sugestões objetivas para aumentar retenção, CTA, edição, legenda, ritmo, estrutura, e ideias de melhorias.
`;

  const body = {
    model: "gpt-4o-mini",
    // ✅ Para reduzir aleatoriedade e dar resultados mais consistentes:
    temperature: 0,
    input: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    text: {
      format: {
        type: "json_schema",
        // ✅ ESTE `name` é obrigatório (era o que estava faltando!)
        name: "viracheck_analysis",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            resumo: { type: "string" },
            nota_viralizacao: { type: "number", minimum: 0, maximum: 100 },
            pontos_fortes: { type: "array", items: { type: "string" } },
            pontos_fracos: { type: "array", items: { type: "string" } },
            sugestoes_melhoria: { type: "array", items: { type: "string" } },
            ganchos_sugeridos: { type: "array", items: { type: "string" } },
            hashtags_sugeridas: { type: "array", items: { type: "string" } },
            recomendacoes_por_plataforma: {
              type: "object",
              additionalProperties: false,
              properties: {
                tiktok: { type: "array", items: { type: "string" } },
                instagram: { type: "array", items: { type: "string" } },
                youtube_shorts: { type: "array", items: { type: "string" } },
                kwai: { type: "array", items: { type: "string" } },
              },
              required: ["tiktok", "instagram", "youtube_shorts", "kwai"],
            },
          },
          required: [
            "resumo",
            "nota_viralizacao",
            "pontos_fortes",
            "pontos_fracos",
            "sugestoes_melhoria",
            "ganchos_sugeridos",
            "hashtags_sugeridas",
            "recomendacoes_por_plataforma",
          ],
        },
      },
    },
  };

  const resp = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(
      `OpenAI API ${resp.status}: ${JSON.stringify(data, null, 2)}`
    );
  }

  // ✅ A Responses API retorna o texto final em `output_text`
  // Com `json_schema`, output_text será JSON válido (string)
  const jsonText = data.output_text as string;
  const parsed = JSON.parse(jsonText) as ViracheckAnalysis;
  return parsed;
}
