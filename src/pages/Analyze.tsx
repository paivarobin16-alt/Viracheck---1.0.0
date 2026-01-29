import { useEffect, useState } from "react";
import "../styles/analyze.css";

type Result = {
  score_viralizacao: number;
  resumo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  melhorias_praticas: string[];
  ganchos: string[];
  legendas: string[];
  hashtags: string[];
  musicas_recomendadas: string[];
  observacoes: string;
};

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [history, setHistory] = useState<Result[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("viracheck-history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

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

      if (!res.ok) throw new Error(data.error || "Erro na análise");

      setResult(data.result);

      const updated = [data.result, ...history].slice(0, 5);
      setHistory(updated);
      localStorage.setItem("viracheck-history", JSON.stringify(updated));
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
        <p className="subtitle">Análise inteligente para viralização</p>

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
            <h2>🔥 Score: {result.score_viralizacao}/100</h2>
            <p>{result.resumo}</p>

            <h3>🎵 Músicas recomendadas</h3>
            <ul>
              {result.musicas_recomendadas.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}

        {history.length > 0 && (
          <div className="history">
            <h3>📜 Histórico</h3>
            {history.map((h, i) => (
              <div key={i} className="history-item">
                Score: {h.score_viralizacao}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
