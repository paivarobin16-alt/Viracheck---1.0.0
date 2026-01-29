import { useState } from "react";
import "../styles/analyze.css";

async function generateFingerprint(file: File) {
  const buffer = await file.slice(0, 1024 * 100).arrayBuffer(); // primeiros 100kb
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [videoURL, setVideoURL] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const fingerprint = await generateFingerprint(file);

      const res = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ video_fingerprint: fingerprint }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro desconhecido");

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
          Analise vídeos e descubra o potencial real de viralização
        </p>

        <div className="card info">
          <b>Como usar:</b>
          <ol>
            <li>Faça upload do vídeo</li>
            <li>Clique em <b>Analisar com IA</b></li>
            <li>Veja score, pontos fracos e melhorias</li>
          </ol>
        </div>

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
          <>
            <div className="score">🔥 Score: {result.score}/100</div>

            <div className="card">
              <b>Resumo</b>
              <p>{result.resumo}</p>
            </div>

            <div className="card">
              <b>Pontos fortes</b>
              <ul>{result.pontos_fortes.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
            </div>

            <div className="card">
              <b>Pontos fracos</b>
              <ul>{result.pontos_fracos.map((p: string, i: number) => <li key={i}>{p}</li>)}</ul>
            </div>

            <div className="card">
              <b>Melhorias práticas</b>
              <ul>{result.melhorias_praticas.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
            </div>

            <div className="card">
              <b>Músicas recomendadas</b>
              <ul>{result.musicas_recomendadas.map((m: string, i: number) => <li key={i}>{m}</li>)}</ul>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
