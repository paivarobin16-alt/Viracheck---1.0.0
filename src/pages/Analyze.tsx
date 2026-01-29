import { useState } from "react";
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
  observacoes: string;
};

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function handleAnalyze() {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // hash simples (nome + tamanho)
      const video_hash = `${file.name}_${file.size}`;

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_hash,
          frames: ["placeholder"], // API já usa cache
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data?.details?.includes("rate_limit")) {
          throw new Error(
            "Limite da IA atingido. Aguarde alguns segundos e tente novamente."
          );
        }
        throw new Error(data?.error || "Erro inesperado");
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="analyze-page">
      <div className="card">
        <h1>🎯 ViraCheck AI</h1>
        <p className="subtitle">
          Upload do vídeo → IA → score + sugestões (PT-BR)
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

        {videoURL && (
          <video src={videoURL} controls className="video-preview" />
        )}

        <button onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analisando..." : "Analisar com IA"}
        </button>

        {loading && <div className="loader">⏳ Analisando vídeo...</div>}

        {error && <div className="error-box">❌ {error}</div>}

        {result && (
          <div className="result-box">
            <h2>🔥 Score: {result.score_viralizacao}/100</h2>

            <p>{result.resumo}</p>

            <h3>✅ Pontos fortes</h3>
            <ul>{result.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h3>⚠️ Pontos fracos</h3>
            <ul>{result.pontos_fracos.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h3>🚀 Melhorias práticas</h3>
            <ul>
              {result.melhorias_praticas.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>

            <h3>🎣 Ganchos</h3>
            <ul>{result.ganchos.map((g, i) => <li key={i}>{g}</li>)}</ul>

            <h3>🏷️ Hashtags</h3>
            <p>{result.hashtags.join(" ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
