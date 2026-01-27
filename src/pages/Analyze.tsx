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
    setProgress("");
    setError("");
    setResult(null);

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
        frames,
      });

      setProgress("Analisando com IA…");
      const data = await analyzeVideo({
        platform,
        duration: Math.round(duration || 15),
        hook: hook.trim(),
        description: description.trim(),
        frames,
        fingerprint,
      });

      setResult(data);
      setProgress("");
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <h1 className="title">Viracheck AI</h1>
          <p className="subtitle">Upload de vídeo + análise com IA (estável com cache)</p>
        </div>
        <div className="badge">Vercel • OpenAI</div>
      </header>

      <div className="grid">
        <section className="card">
          <h2 className="cardTitle">1) Upload do vídeo</h2>

          <input
            className="input"
            type="file"
            accept="video/mp4,video/quicktime,video/webm,video/*"
            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          />

          {videoFile && (
            <>
              <div style={{ marginTop: 10 }} className="subtitle">
                Arquivo: <strong style={{ color: "rgba(255,255,255,.92)" }}>{videoFile.name}</strong>
              </div>
              <video className="video" src={videoUrl} controls playsInline />
            </>
          )}
        </section>

        <section className="card">
          <h2 className="cardTitle">2) Contexto</h2>

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
          <textarea className="textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explique o que acontece no vídeo…" />

          <button className="button" onClick={handleAnalyze} disabled={loading}>
            {loading ? "Analisando…" : "Analisar com IA"}
          </button>

          {progress && <div className="notice">{progress}</div>}
          {error && <div className="error">{error}</div>}
        </section>

        <section className="card spanAll">
          <h2 className="cardTitle">3) Resultado</h2>

          {!result && <div className="subtitle">Envie um vídeo e clique em “Analisar”.</div>}

          {result && (
            <>
              <div className="scoreWrap">
                <div>
                  <div className="subtitle">Score</div>
                  <div className="scoreBig">{result.score}/100</div>
                  <div style={{ marginTop: 6 }}>
                    <span className="chip">{result.cached ? "✅ Cache (mesmo resultado)" : "🧠 Novo cálculo"}</span>
                  </div>
                </div>

                <div className="row" style={{ justifyContent: "flex-end" }}>
                  <button className="button secondaryBtn smallBtn" onClick={() => setResult(null)} type="button">
                    Limpar
                  </button>
                </div>
              </div>

              <div className="grid" style={{ marginTop: 12 }}>
                <div className="block">
                  <h3 className="h3">✅ Pontos fortes</h3>
                  <ul className="ul">{result.strengths.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>

                <div className="block">
                  <h3 className="h3">⚠️ Pontos fracos</h3>
                  <ul className="ul">{result.weaknesses.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>

                <div className="block spanAll">
                  <h3 className="h3">🔧 Melhorias</h3>
                  <ul className="ul">{result.improvements.map((x, i) => <li key={i}>{x}</li>)}</ul>
                </div>

                <div className="block">
                  <h3 className="h3">🧠 Título</h3>
                  <div>{result.title}</div>
                </div>

                <div className="block">
                  <h3 className="h3">✍️ Legenda</h3>
                  <div>{result.caption}</div>
                </div>

                <div className="block spanAll">
                  <h3 className="h3">📣 CTA</h3>
                  <div>{result.cta}</div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
