import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

// cache em memória (estável)
const cache = new Map<string, any>();

function scoreFromFingerprint(fp: string) {
  const hash = crypto.createHash("sha256").update(fp).digest("hex");
  const slice = parseInt(hash.slice(0, 6), 16);
  return Math.round((slice % 7000) / 70); // 0–100 real
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST" });
  }

  const { video_fingerprint } = req.body;

  if (!video_fingerprint) {
    return res.status(400).json({ error: "video_fingerprint obrigatório" });
  }

  // cache: mesmo vídeo = mesmo resultado
  if (cache.has(video_fingerprint)) {
    return res.status(200).json({
      cached: true,
      result: cache.get(video_fingerprint),
    });
  }

  const score = scoreFromFingerprint(video_fingerprint);

  const result = {
    score,
    diagnostico:
      score >= 75
        ? "Vídeo com alto potencial de viralização"
        : score >= 50
        ? "Vídeo mediano, pode melhorar"
        : "Vídeo fraco para viralização",
    pontos_fortes:
      score >= 60
        ? ["Bom gancho inicial", "Ritmo aceitável"]
        : ["Tema compreensível"],
    pontos_fracos:
      score >= 60
        ? ["Falta emoção", "CTA fraco"]
        : ["Gancho fraco", "Pouca emoção", "Sem tendência clara"],
    melhorias_praticas: [
      "Adicionar texto forte nos 2 primeiros segundos",
      "Usar música em alta no momento",
      "Finalizar com chamada clara para ação",
    ],
    musicas_recomendadas: [
      "Música popular do momento",
      "Beat acelerado (estilo Reels/TikTok)",
    ],
  };

  cache.set(video_fingerprint, result);

  return res.status(200).json({
    cached: false,
    result,
  });
}
