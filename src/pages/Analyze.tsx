import { useState } from "react";
import { analyzeVideo } from "../services/videoAnalysisService";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [duration, setDuration] = useState(15);
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string>("");

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const data = await analyzeVideo({ platform, duration, hook, description });
      setResult(data);
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <h1>Viracheck AI 🚀</h1>

      <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
        <label>
          Plataforma
          <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }}>
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
            min={1}
            max={180}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <label>
          Gancho inicial
          <input value={hook} onChange={(e) => setHook(e.target.value)} style={{ width: "100%", padding: 10, marginTop: 6 }} />
        </label>

        <label>
          Descrição do vídeo
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            style={{ width: "100%", padding: 10, marginTop: 6 }}
          />
        </label>

        <button onClick={handleAnalyze} disabled={loading} style={{ padding: 12, borderRadius: 10 }}>
          {loading ? "Analisando..." : "Analisar"}
        </button>

        {error && (
          <pre style={{ background: "#ffe7e7", padding: 12, borderRadius: 10, overflow: "auto" }}>
            {error}
          </pre>
        )}
      </div>

      {result && (
        <pre style={{ marginTop: 16, background: "#f5f5f5", padding: 12, borderRadius: 10, overflow: "auto" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  );
}
