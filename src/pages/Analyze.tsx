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
      const video_hash = `${file.name}_${file.size}`;

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_hash }),
      });

      const text = await res.text();

      // ⚠️ Proteção TOTAL contra resposta inválida
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error("A IA retornou uma resposta inválida. Tente novamente.");
      }

      if (!res.ok) {
        throw new Error(
          data?.details ||
            data?.error ||
            "Falha na OpenAI. Aguarde alguns segundos e tente novamente."
        );
      }

      setResult(data.result);
    } catch (err: any) {
      setError(err.message);
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

        {videoURL && (
          <video className="video" src={videoURL} controls />
        )}

        <button className="main-btn" onClick={handleAnalyze} disabled={loading}>
          {loading ? "Analisando com IA..." : "Analisar com IA"}
        </button>

        {loading && <div className="loader">🤖 Processando vídeo...</div>}

        {error && (
          <div className="error">
            ❌ {error}
          </div>
        )}

        {result && (
          <div className="result">
            <div className="score">
              🔥 Score: <span>{result.score_viralizacao}</span>/100
            </div>

            <p>{result.resumo}</p>

            <h3>✅ Pontos fortes</h3>
            <ul>{result.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h3>⚠️ Pontos fracos</h3>
            <ul>{result.pontos_fracos.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h3>🚀 Melhorias</h3>
            <ul>{result.melhorias_praticas.map((p, i) => <li key={i}>{p}</li>)}</ul>

            <h3>🏷️ Hashtags</h3>
            <p className="tags">{result.hashtags.join(" ")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
