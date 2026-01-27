import { useMemo, useState } from "react";
import { analyzeVideo, VideoAnalysisResult } from "../services/videoAnalysisService";
import { extractFramesFromVideoFile } from "../utils/frameExtractor";

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
      if (!videoFile) {
        throw new Error("Selecione um vídeo para analisar (upload).");
      }

      setProgress("Extraindo frames do vídeo…");
      const { frames, duration } = await extractFramesFromVideoFile(videoFile, 5, 640);

      setProgress("Enviando para IA…");
      const data = await analyzeVideo({
        platform,
        duration: Math.round(duration || 15),
        hook: hook.trim(),
        description: description.trim(),
        frames,
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
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <h1 style={styles.h1}>Viracheck AI</h1>
            <p style={styles.sub}>Análise profissional para TikTok, Reels e Shorts (com frames do vídeo).</p>
          </div>
          <div style={styles.badge}>OpenAI Vision</div>
        </header>

        <div style={styles.grid}>
          <section style={styles.card}>
            <h2 style={styles.h2}>1) Upload do vídeo</h2>

            <input
              type="file"
              accept="video/*"
              onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
            />

            {videoFile && (
              <div style={{ marginTop: 12 }}>
                <div style={styles.metaRow}>
                  <span style={styles.metaKey}>Arquivo</span>
                  <span style={styles.metaVal}>{videoFile.name}</span>
                </div>

                <video
                  src={videoUrl}
                  controls
                  style={styles.video}
                />
                <p style={styles.tip}>
                  Dica: vídeos com boa luz e texto legível nos frames melhoram a análise.
                </p>
              </div>
            )}
          </section>

          <section style={styles.card}>
            <h2 style={styles.h2}>2) Contexto do vídeo</h2>

            <label style={styles.label}>Plataforma</label>
            <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={styles.input}>
              <option>Todas</option>
              <option>TikTok</option>
              <option>Instagram Reels</option>
              <option>YouTube Shorts</option>
            </select>

            <label style={styles.label}>Gancho (primeiros 1–3s)</label>
            <input
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              placeholder='Ex: "Você está errando isso…"'
              style={styles.input}
            />

            <label style={styles.label}>Descrição (o que acontece no vídeo)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Falas, texto na tela, cenário, objetivo do vídeo…"
              rows={5}
              style={{ ...styles.input, resize: "vertical" }}
            />

            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{ ...styles.button, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? "Analisando…" : "Analisar com IA"}
            </button>

            {progress && <div style={styles.progress}>{progress}</div>}
            {error && <div style={styles.error}>{error}</div>}
          </section>

          <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
            <h2 style={styles.h2}>3) Resultado</h2>

            {!result && <p style={styles.muted}>Envie um vídeo e clique em analisar para ver o resultado aqui.</p>}

            {result && (
              <div style={styles.resultGrid}>
                <div style={styles.scoreBox}>
                  <div style={styles.scoreLabel}>Score de viralização</div>
                  <div style={styles.score}>{result.score}/100</div>
                </div>

                <ResultList title="✅ Pontos fortes" items={result.strengths} />
                <ResultList title="⚠️ Pontos fracos" items={result.weaknesses} />
                <ResultList title="🔧 Melhorias" items={result.improvements} />

                <div style={styles.block}>
                  <h3 style={styles.h3}>🧠 Título sugerido</h3>
                  <p style={styles.p}>{result.title}</p>
                </div>

                <div style={styles.block}>
                  <h3 style={styles.h3}>✍️ Legenda sugerida</h3>
                  <p style={styles.p}>{result.caption}</p>
                </div>

                <div style={styles.block}>
                  <h3 style={styles.h3}>📣 CTA sugerido</h3>
                  <p style={styles.p}>{result.cta}</p>
                </div>

                {!!result.frame_insights?.length && (
                  <ResultList title="🖼️ Insights dos frames (visual)" items={result.frame_insights} />
                )}
              </div>
            )}
          </section>
        </div>

        <footer style={styles.footer}>
          <span>© {new Date().getFullYear()} Viracheck AI</span>
          <span style={styles.footerDot}>•</span>
          <span>Upload + Frames + OpenAI Vision</span>
        </footer>
      </div>
    </div>
  );
}

function ResultList({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={styles.block}>
      <h3 style={styles.h3}>{title}</h3>
      <ul style={styles.ul}>
        {(items || []).map((it, idx) => (
          <li key={idx} style={styles.li}>{it}</li>
        ))}
      </ul>
    </div>
  );
}

const styles: Record<string, any> = {
  page: { minHeight: "100vh", background: "#0b0d12", padding: 18 },
  shell: { maxWidth: 1100, margin: "0 auto" },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    padding: 18,
    borderRadius: 16,
    background: "linear-gradient(180deg, #121826 0%, #0f1420 100%)",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
  },
  h1: { margin: 0, fontSize: 28, letterSpacing: -0.4 },
  sub: { margin: "6px 0 0", color: "rgba(255,255,255,0.7)" },
  badge: {
    padding: "8px 10px",
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    fontWeight: 700,
  },

  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 14 },
  card: {
    padding: 16,
    borderRadius: 16,
    background: "#0f1420",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "#fff",
  },
  h2: { margin: "0 0 12px", fontSize: 16, color: "rgba(255,255,255,0.9)" },
  label: { display: "block", marginTop: 10, marginBottom: 6, color: "rgba(255,255,255,0.75)", fontSize: 13 },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#0b0f18",
    color: "#fff",
    outline: "none",
  },
  button: {
    marginTop: 12,
    width: "100%",
    padding: "12px 14px",
    borderRadius: 12,
    border: 0,
    background: "#ffffff",
    color: "#0b0d12",
    fontWeight: 800,
    cursor: "pointer",
  },
  progress: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
  },
  error: {
    marginTop: 10,
    padding: 10,
    borderRadius: 12,
    background: "rgba(255,0,0,0.12)",
    border: "1px solid rgba(255,0,0,0.25)",
    color: "#ffd1d1",
    fontSize: 13,
    whiteSpace: "pre-wrap",
  },
  video: {
    width: "100%",
    borderRadius: 14,
    marginTop: 10,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "#000",
  },
  tip: { marginTop: 10, color: "rgba(255,255,255,0.65)", fontSize: 12 },

  resultGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  scoreBox: {
    gridColumn: "1 / -1",
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
  },
  scoreLabel: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 700 },
  score: { fontSize: 34, fontWeight: 900, marginTop: 6 },

  block: {
    padding: 14,
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  h3: { margin: "0 0 8px", fontSize: 14, color: "rgba(255,255,255,0.9)" },
  p: { margin: 0, color: "rgba(255,255,255,0.85)" },
  ul: { margin: 0, paddingLeft: 16, color: "rgba(255,255,255,0.85)" },
  li: { marginBottom: 6 },

  muted: { color: "rgba(255,255,255,0.65)" },
  metaRow: { display: "flex", justifyContent: "space-between", gap: 10, marginTop: 10 },
  metaKey: { color: "rgba(255,255,255,0.65)", fontSize: 12 },
  metaVal: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: 700 },

  footer: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    background: "#0f1420",
    border: "1px solid rgba(255,255,255,0.08)",
    color: "rgba(255,255,255,0.65)",
    display: "flex",
    justifyContent: "center",
    gap: 10,
    fontSize: 12,
  },
  footerDot: { opacity: 0.5 },
};
