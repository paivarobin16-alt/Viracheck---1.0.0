import { useState } from "react";
import { analyzeVideo, VideoAnalysisResult } from "../services/videoAnalysisService";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [duration, setDuration] = useState(15);
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
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1>Viracheck AI 🚀</h1>
      <p>Analise seu vídeo e descubra o potencial de viralização</p>

      <label>Plataforma</label>
      <select value={platform} onChange={e => setPlatform(e.target.value)}>
        <option>Todas</option>
        <option>TikTok</option>
        <option>Instagram Reels</option>
        <option>YouTube Shorts</option>
      </select>

      <label>Duração (segundos)</label>
      <input
        type="number"
        value={duration}
        onChange={e => setDuration(Number(e.target.value))}
      />

      <label>Gancho inicial</label>
      <input
        placeholder="Ex: Você está cometendo esse erro..."
        value={hook}
        onChange={e => setHook(e.target.value)}
      />

      <label>Descrição do vídeo</label>
      <textarea
        rows={4}
        value={description}
        onChange={e => setDescription(e.target.value)}
      />

      <button onClick={handleAnalyze} disabled={loading}>
        {loading ? "Analisando..." : "Analisar vídeo"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 32 }}>
          <h2>🔥 Resultado</h2>
          <h3>Score de viralização: {result.score}/100</h3>

          <h4>✅ Pontos fortes</h4>
          <ul>{result.strengths.map((i, idx) => <li key={idx}>{i}</li>)}</ul>

          <h4>⚠️ Pontos fracos</h4>
          <ul>{result.weaknesses.map((i, idx) => <li key={idx}>{i}</li>)}</ul>

          <h4>🔧 Sugestões</h4>
          <ul>{result.improvements.map((i, idx) => <li key={idx}>{i}</li>)}</ul>

          <h4>🧠 Título sugerido</h4>
          <p>{result.title}</p>

          <h4>✍️ Legenda</h4>
          <p>{result.caption}</p>

          <h4>📣 CTA</h4>
          <p>{result.cta}</p>
        </div>
      )}
    </div>
  );
}

