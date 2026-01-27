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
  const [progress, setProgress] = useState<string>("");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState<string>("");

  async function handleAnalyze() {
    setLoading(true);
    setProgress("");
    setError("");
    setResult(null);

    try {
      if (!videoFile) throw new Error("Selecione um vídeo para analisar.");

      setProgress("Extraindo frames do vídeo…");
      const { frames, duration } = await extractFramesFromVideoFile(videoFile, 5, 640);

      setProgress("Gerando fingerprint…");
      const fingerprint = await makeVideoFingerprint({
        platform,
        duration: Math.round(duration || 15),
        hook,
        description,
        frames,
      });

      setProgress("Enviando para IA…");
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
    <div style={{ minHeight: "100vh", background: "#0b0d12", padding: 18 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", color: "#fff", fontFamily: "system-ui" }}>
        <header
          style={{
            padding: 18,
            borderRadius: 16,
            background: "linear-gradient(180deg, #121826 0%, #0f1420 100%)",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28 }}>Viracheck AI</h1>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.7)" }}>
            Upload + frames + cache (mesmo vídeo = mesma resposta)
          </p>
        </header>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 }}>
          <section
            style={{
              padding: 16,
              borderRadius: 16,
              background: "#0f1420",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "rgba(255,255,255,0.9)" }}>
              1) Upload do vídeo
            </h2>

            <input
              type="file"
              accept="video/mp4,video/quicktime,video/webm,video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />

            {videoFile && (
              <div style={{ marginTop: 12 }}>
                <div style={{ opacity: 0.8, fontSize: 12, marginBottom: 8 }}>{videoFile.name}</div>
                <video
                  src={videoUrl}
                  controls
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "#000",
                  }}
                />
              </div>
            )}
          </section>

          <section
            style={{
              padding: 16,
              borderRadius: 16,
              background: "#0f1420",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "rgba(255,255,255,0.9)" }}>
              2) Contexto
            </h2>

            <label style={{ display: "block", marginTop: 10, marginBottom: 6, opacity: 0.8, fontSize: 13 }}>
              Plataforma
            </label>
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "#0b0f18",
                color: "#fff",
              }}
            >
              <option>Todas</option>
              <option>TikTok</option>
              <option>Instagram Reels</option>
              <option>YouTube Shorts</option>
            </select>

            <label style={{ display: "block", marginTop: 10, marginBottom: 6, opacity: 0.8, fontSize: 13 }}>
              Gancho
            </label>
            <input
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "#0b0f18",
                color: "#fff",
              }}
            />

            <label style={{ display: "block", marginTop: 10, marginBottom: 6, opacity: 0.8, fontSize: 13 }}>
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "#0b0f18",
                color: "#fff",
                resize: "vertical",
              }}
            />

            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "12px 14px",
                borderRadius: 12,
                border: 0,
                background: "#ffffff",
                color: "#0b0d12",
                fontWeight: 800,
                cursor: "pointer",
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? "Analisando…" : "Analisar com IA"}
            </button>

            {progress && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,255,255,0.06)", fontSize: 13 }}>
                {progress}
              </div>
            )}
            {error && (
              <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: "rgba(255,0,0,0.12)", fontSize: 13 }}>
                {error}
              </div>
            )}
          </section>

          <section
            style={{
              gridColumn: "1 / -1",
              padding: 16,
              borderRadius: 16,
              background: "#0f1420",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <h2 style={{ margin: "0 0 12px", fontSize: 16, color: "rgba(255,255,255,0.9)" }}>
              3) Resultado
            </h2>

            {!result && <p style={{ opacity: 0.7 }}>Envie um vídeo e clique em “Analisar”.</p>}

            {result && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: 14,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.10)",
                  }}
                >
                  <div style={{ opacity: 0.7, fontSize: 12, fontWeight: 700 }}>Score</div>
                  <div style={{ fontSize: 34, fontWeight: 900, marginTop: 6 }}>{result.score}/100</div>
                  {result.cached && <div style={{ marginTop: 6, opacity: 0.8 }}>✅ Resultado do cache</div>}
                </div>

                <Block title="✅ Pontos fortes" items={result.strengths} />
                <Block title="⚠️ Pontos fracos" items={result.weaknesses} />
                <Block title="🔧 Melhorias" items={result.improvements} />

                <TextBlock title="🧠 Título" text={result.title} />
                <TextBlock title="✍️ Legenda" text={result.caption} />
                <TextBlock title="📣 CTA" text={result.cta} />

                {result.frame_insights?.length ? <Block title="🖼️ Insights dos frames" items={result.frame_insights} /> : null}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Block({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>{title}</h3>
      <ul style={{ margin: 0, paddingLeft: 16, opacity: 0.9 }}>
        {(items || []).map((it, idx) => (
          <li key={idx} style={{ marginBottom: 6 }}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div style={{ padding: 14, borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 style={{ margin: "0 0 8px", fontSize: 14 }}>{title}</h3>
      <p style={{ margin: 0, opacity: 0.9 }}>{text}</p>
    </div>
  );
}
