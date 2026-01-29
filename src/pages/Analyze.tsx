import { useState } from "react";
import "../styles/analyze.css";

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const video_hash = `${file.name}_${file.size}`;

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_hash }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao analisar");
      }

      setResult(data.result);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-bg">
      <div className="glass-card">
        <h1>🚀 ViraCheck AI</h1>
        <p className="subtitle">
          Análise inteligente de vídeos para viralização
        </p>

        <input
          type="file"
          accept="video/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              setFile(f);
              setVideoURL(URL.createObjectURL(f));
            }
          }}
        />

        {videoURL && <video src={videoURL} controls className="video" />}

        <button className="main-btn" onClick={analyze} disabled={loading}>
          {loading ? "Analisando..." : "Analisar com IA"}
        </button>

        {error && <div className="error">❌ {error}</div>}

        {result && (
          <div className="result">
            <div className="score">
              🔥 Score: <span>{result.score_viralizacao}</span>/100
            </div>
            <p>{result.resumo}</p>
          </div>
        )}
      </div>
    </div>
  );
}
