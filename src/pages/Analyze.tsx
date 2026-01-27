import { useMemo, useState } from "react";
import { analyzeVideo, VideoAnalysisResult } from "../services/videoAnalysisService";
import { extractFramesFromVideoFile } from "../utils/frameExtractor";
import { makeVideoFingerprint } from "../utils/fingerprint";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(
    () => (videoFile ? URL.createObjectURL(videoFile) : ""),
    [videoFile]
  );

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    try {
      if (!videoFile) throw new Error("Selecione um vídeo.");

      setLoading(true);
      setProgress("Extraindo frames…");
      setError("");
      setResult(null);

      const { frames, duration } = await extractFramesFromVideoFile(videoFile, 5);

      setProgress("Analisando com IA…");
      const fingerprint = await makeVideoFingerprint({
        platform,
        duration: Math.round(duration || 15),
        hook,
        description,
        frames,
      });

      const data = await analyzeVideo({
        platform,
        duration: Math.round(duration || 15),
        hook,
        description,
        frames,
        fingerprint,
      });

      setResult(data);
      setProgress("");
    } catch (e: any) {
      setError(e.message || "Erro inesperado");
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Viracheck AI</h1>
        <p>Análise profissional de vídeos com Inteligência Artificial</p>
      </header>

      <div className="grid">
        {/* Upload */}
        <section className="card">
          <h2>🎥 Enviar vídeo</h2>

          <input
            className="input"
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />

          {videoFile && (
            <video className="video" src={videoUrl} controls playsInline />
          )}
        </section>

        {/* Contexto */}
        <section className="card">
          <h2>🧠 Contexto</h2>

          <label className="label">Plataforma</label>
          <select
            className="select"
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
          >
            <option>Todas</option>
            <option>TikTok</option>
            <option>Instagram Reels</option>
            <option>YouTube Shorts</option>
          </select>

          <label className="label">Gancho</label>
          <input
            className="input"
            placeholder="Ex: Você está errando isso…"
            value={hook}
            onChange={(e) => setHook(e.target.value)}
          />

          <label className="label">Descrição</label>
          <textarea
            className="textarea"
            placeholder="Descreva o conteúdo do vídeo"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <button className="button" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analisando…" : "Analisar vídeo"}
          </button>

          {progress && <div className="notice">{progress}</div>}
          {error && <div className="error">{error}</div>}
        </section>

        {/* Resultado */}
        <section className="card spanAll">
          <h2>📊 Resultado</h2>

          {!result && (
            <div className="notice">
              Envie um vídeo para receber a análise da IA.
            </div>
          )}

          {result && (
            <>
              <div className="scoreBox">
                <div className="score">{result.score}/100</div>
                <span className="badge">
                  {result.cached ? "Resultado em cache" : "Nova análise"}
                </span>
              </div>

              <div className="block">
                <h3>✅ Pontos fortes</h3>
                <ul>{result.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>

              <div className="block">
                <h3>⚠️ Pontos fracos</h3>
                <ul>{result.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>

              <div className="block">
                <h3>🚀 Melhorias</h3>
                <ul>{result.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>
              </div>

              <div className="block">
                <h3>📝 Sugestão de título</h3>
                <p>{result.title}</p>
              </div>

              <div className="block">
                <h3>✍️ Legenda</h3>
                <p>{result.caption}</p>
              </div>

              <div className="block">
                <h3>📣 CTA</h3>
                <p>{result.cta}</p>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
