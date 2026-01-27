import { useMemo, useState } from "react";
import { analyzeVideo, VideoAnalysisResult } from "../services/videoAnalysisService";
import { extractFramesFromVideoFile } from "../utils/frameExtractor";
import { makeVideoFingerprint } from "../utils/fingerprint";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setResult(null);
    setProgress("");

    try {
      if (!videoFile) throw new Error("Selecione um vídeo para analisar.");

      setProgress("Extraindo frames…");
      const { frames, duration } = await extractFramesFromVideoFile(videoFile, 5, 640);

      setProgress("Gerando fingerprint…");
      const fingerprint = await makeVideoFingerprint({
        platform,
        duration: Math.round(duration || 15),
        hook,
        description,
        frames
      });

      setProgress("Analisando com IA…");
      const data = await analyzeVideo({
        platform,
        duration: Math.round(duration || 15),
        hook: hook.trim(),
        description: description.trim(),
        frames,
        fingerprint
      });

      setResult(data);
      setProgress("");
    } catch (e: any) {
      setError(e?.message || String(e));
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Viracheck AI</h1>
        <p>Upload de vídeo + análise com IA (mobile-first, visual premium)</p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>🎥 Enviar vídeo</h2>

          <input
            className="input"
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />

          {videoFile && <video className="video" src={videoUrl} controls playsInline />}
        </section>

        <section className="card">
          <h2>🧠 Contexto</h2>

          <label className="label">Plataforma</label>
          <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option>Todas</option>
            <option>TikTok</option>
            <option>Instagram Reels</option>
            <option>YouTube Shorts</option>
          </select>

          <label className="label">Gancho</label>
          <input className="input" value={hook} onChange={(e) => setHook(e.target.value)} placeholder='Ex: "Você tá errando isso…"' />

          <label className="label">Descrição</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que acontece no vídeo…" />

          <button className="button" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analisando…" : "Analisar"}
          </button>

          {progress && <div className="notice">{progress}</div>}
          {error && <div className="error">{error}</div>}
        </section>

        <section className="card spanAll">
          <h2>📊 Resultado</h2>

          {!result && <div className="notice">Envie um vídeo e clique em “Analisar”.</div>}

          {result && (
            <>
              <div className="scoreBox">
                <div>
                  <div style={{ color: "rgba(255,255,255,.70)", fontSize: 12, fontWeight: 800 }}>Score</div>
                  <div className="score">{result.score}/100</div>
                </div>

                <div className="badge">{result.cached ? "✅ Cache (estável)" : "🧠 Nova análise"}</div>
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
                <h3>🧠 Título sugerido</h3>
                <div>{result.title}</div>
              </div>

              <div className="block">
                <h3>✍️ Legenda</h3>
                <div>{result.caption}</div>
              </div>

              <div className="block">
                <h3>📣 CTA</h3>
                <div>{result.cta}</div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
import { useMemo, useState } from "react";
import { analyzeVideo, VideoAnalysisResult } from "../services/videoAnalysisService";
import { extractFramesFromVideoFile } from "../utils/frameExtractor";
import { makeVideoFingerprint } from "../utils/fingerprint";

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState("");

  async function handleAnalyze() {
    setLoading(true);
    setError("");
    setResult(null);
    setProgress("");

    try {
      if (!videoFile) throw new Error("Selecione um vídeo para analisar.");

      setProgress("Extraindo frames…");
      const { frames, duration } = await extractFramesFromVideoFile(videoFile, 5, 640);

      setProgress("Gerando fingerprint…");
      const fingerprint = await makeVideoFingerprint({
        platform,
        duration: Math.round(duration || 15),
        hook,
        description,
        frames
      });

      setProgress("Analisando com IA…");
      const data = await analyzeVideo({
        platform,
        duration: Math.round(duration || 15),
        hook: hook.trim(),
        description: description.trim(),
        frames,
        fingerprint
      });

      setResult(data);
      setProgress("");
    } catch (e: any) {
      setError(e?.message || String(e));
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <h1>Viracheck AI</h1>
        <p>Upload de vídeo + análise com IA (mobile-first, visual premium)</p>
      </header>

      <div className="grid">
        <section className="card">
          <h2>🎥 Enviar vídeo</h2>

          <input
            className="input"
            type="file"
            accept="video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />

          {videoFile && <video className="video" src={videoUrl} controls playsInline />}
        </section>

        <section className="card">
          <h2>🧠 Contexto</h2>

          <label className="label">Plataforma</label>
          <select className="select" value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option>Todas</option>
            <option>TikTok</option>
            <option>Instagram Reels</option>
            <option>YouTube Shorts</option>
          </select>

          <label className="label">Gancho</label>
          <input className="input" value={hook} onChange={(e) => setHook(e.target.value)} placeholder='Ex: "Você tá errando isso…"' />

          <label className="label">Descrição</label>
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o que acontece no vídeo…" />

          <button className="button" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analisando…" : "Analisar"}
          </button>

          {progress && <div className="notice">{progress}</div>}
          {error && <div className="error">{error}</div>}
        </section>

        <section className="card spanAll">
          <h2>📊 Resultado</h2>

          {!result && <div className="notice">Envie um vídeo e clique em “Analisar”.</div>}

          {result && (
            <>
              <div className="scoreBox">
                <div>
                  <div style={{ color: "rgba(255,255,255,.70)", fontSize: 12, fontWeight: 800 }}>Score</div>
                  <div className="score">{result.score}/100</div>
                </div>

                <div className="badge">{result.cached ? "✅ Cache (estável)" : "🧠 Nova análise"}</div>
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
                <h3>🧠 Título sugerido</h3>
                <div>{result.title}</div>
              </div>

              <div className="block">
                <h3>✍️ Legenda</h3>
                <div>{result.caption}</div>
              </div>

              <div className="block">
                <h3>📣 CTA</h3>
                <div>{result.cta}</div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
