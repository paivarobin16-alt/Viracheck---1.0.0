import { useState } from "react";
import { analyzeVideo, VideoAnalysisResult } from "../services/videoAnalysisService";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [duration, setDuration] = useState<number>(15);
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const data = await analyzeVideo({
        platform,
        duration,
        hook,
        description,
      });
      setResult(data);
    } catch (err: any) {
      setError(err?.message || "Erro ao analisar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui, Arial" }}>
      <h1 style={{ marginBottom: 4 }}>Viracheck AI 🚀</h1>
      <p style={{ marginTop: 0, color: "#555" }}>
        Analise vídeos para TikTok, Reels e Shorts e receba sugestões automáticas.
      </p>

      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label>
          Plataforma
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          >
            <option>Todas</option>
            <option>TikTok</option>
            <option>Instagram Reels</option>
            <option>YouTube Shorts</option>
          </select>
        </label>

        <label>
          Duração (segundos)
          <input
            type="number"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
            min={1}
            max={180}
          />
        </label>

        <label>
          Gancho inicial (primeiros 1–3s)
          <input
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder='Ex: "Você está errando isso..."'
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Descrição do vídeo (o que acontece, cenário, falas, texto na tela, etc.)
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Descreva bem para a IA analisar melhor..."
            style={{ display: "block", width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <button
          onClick={handleAnalyze}
          disabled={loading || !hook.trim() || !description.trim()}
          style={{
            padding: "12px 14px",
            cursor: loading ? "not-allowed" : "pointer",
            background: "#111",
            color: "#fff",
            border: 0,
            borderRadius: 10,
            fontWeight: 700,
            opacity: loading || !hook.trim() || !description.trim() ? 0.6 : 1,
          }}
        >
          {loading ? "Analisando..." : "Analisar vídeo"}
        </button>

        {error && (
          <div style={{ padding: 12, background: "#ffe7e7", borderRadius: 10, color: "#a40000" }}>
            {error}
          </div>
        )}
      </div>

      {result && (
        <div style={{ marginTop: 28, padding: 18, background: "#f7f7f7", borderRadius: 14 }}>
          <h2 style={{ marginTop: 0 }}>Resultado</h2>
          <h3 style={{ marginTop: 8 }}>Score: {result.score}/100</h3>

          <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
            <Section title="✅ Pontos fortes" items={result.strengths} />
            <Section title="⚠️ Pontos fracos" items={result.weaknesses} />
            <Section title="🔧 Sugestões de melhoria" items={result.improvements} />

            <div style={{ background: "#fff", padding: 14, borderRadius: 12 }}>
              <h4 style={{ marginTop: 0 }}>🧠 Título sugerido</h4>
              <p style={{ marginBottom: 0 }}>{result.title}</p>
            </div>

            <div style={{ background: "#fff", padding: 14, borderRadius: 12 }}>
              <h4 style={{ marginTop: 0 }}>✍️ Legenda sugerida</h4>
              <p style={{ marginBottom: 0 }}>{result.caption}</p>
            </div>

            <div style={{ background: "#fff", padding: 14, borderRadius: 12 }}>
              <h4 style={{ marginTop: 0 }}>📣 CTA sugerido</h4>
              <p style={{ marginBottom: 0 }}>{result.cta}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ background: "#fff", padding: 14, borderRadius: 12 }}>
      <h4 style={{ marginTop: 0 }}>{title}</h4>
      <ul style={{ marginBottom: 0 }}>
        {(items || []).map((it, idx) => (
          <li key={idx}>{it}</li>
        ))}
      </ul>
    </div>
  );
}
