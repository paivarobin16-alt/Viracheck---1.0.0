import React, { useMemo, useRef, useState } from "react";

type Result = {
  criterios: {
    hook_impacto: number;
    qualidade_visual: number;
    clareza_mensagem: number;
    legibilidade_texto_legenda: number;
    potencial_engajamento: number;
  };
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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Extrai frames no navegador:
 * - pega 1 frame por "stepSec"
 * - reduz para widthMax para ficar leve
 * - gera data:image/jpeg;base64,...
 */
async function extractFramesFromVideo(file: File, stepSec = 1.0, widthMax = 640, maxFrames = 18) {
  const url = URL.createObjectURL(file);

  const video = document.createElement("video");
  video.src = url;
  video.crossOrigin = "anonymous";
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar o vídeo"));
  });

  const duration = video.duration;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  const ratio = video.videoWidth / video.videoHeight || 1;
  const w = Math.min(widthMax, video.videoWidth || widthMax);
  const h = Math.round(w / ratio);

  canvas.width = w;
  canvas.height = h;

  const frames: string[] = [];

  const steps: number[] = [];
  for (let t = 0; t < duration; t += stepSec) steps.push(t);
  if (!steps.length) steps.push(0);

  // limita quantidade
  const picked = steps.slice(0, maxFrames);

  for (const t of picked) {
    await new Promise<void>((resolve) => {
      video.currentTime = t;
      const onSeeked = () => {
        video.removeEventListener("seeked", onSeeked);
        resolve();
      };
      video.addEventListener("seeked", onSeeked);
    });

    ctx.drawImage(video, 0, 0, w, h);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    frames.push(dataUrl);
  }

  URL.revokeObjectURL(url);
  return frames;
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardTitle}>{title}</div>
      <div>{children}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span style={styles.pill}>{children}</span>;
}

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<Result | null>(null);
  const [cached, setCached] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  const scoreColor = useMemo(() => {
    const s = result?.score_viralizacao ?? 0;
    if (s >= 80) return "#2dd4bf";
    if (s >= 60) return "#60a5fa";
    if (s >= 40) return "#fbbf24";
    return "#fb7185";
  }, [result?.score_viralizacao]);

  const onPick = (f: File | null) => {
    setResult(null);
    setError("");
    setCached(false);
    setStatus("");
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    if (f) setPreviewUrl(URL.createObjectURL(f));
    else setPreviewUrl("");
  };

  async function analyze() {
    try {
      setError("");
      setResult(null);
      setCached(false);

      if (!file) {
        setError("Escolha um vídeo primeiro.");
        return;
      }

      setLoading(true);
      setStatus("Gerando fingerprint do vídeo...");

      const buf = await file.arrayBuffer();
      const video_hash = await sha256Hex(buf);

      setStatus("Extraindo frames para análise...");
      const frames = await extractFramesFromVideo(file, 1.0, 640, 16);

      setStatus("Enviando para a IA...");
      const r = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_hash,
          frames, // data URLs
        }),
      });

      const data = await r.json().catch(() => null);

      if (!r.ok) {
        const msg =
          data?.details?.toString?.() ||
          data?.error?.toString?.() ||
          `Erro HTTP ${r.status}`;
        throw new Error(msg);
      }

      if (!data?.result) throw new Error("Resposta inválida: sem 'result'.");

      setResult(data.result);
      setCached(Boolean(data.cached));
      setStatus("✅ Análise concluída!");
    } catch (e: any) {
      setError(`❌ Falha na OpenAI API: ${e?.message || String(e)}`);
      setStatus("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.shell}>
        <header style={styles.header}>
          <div>
            <div style={styles.h1}>📹 Analisar vídeo</div>
            <div style={styles.sub}>
              Envie um vídeo e receba sugestões para melhorar e viralizar (PT-BR).
            </div>
          </div>

          <div style={styles.badge}>🇧🇷 PT-BR</div>
        </header>

        <div style={styles.grid}>
          <Card title="Upload do vídeo">
            <div style={styles.field}>
              <label style={styles.label}>Escolha um arquivo</label>
              <input
                style={styles.inputFile}
                type="file"
                accept="video/*"
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
              />
            </div>

            {previewUrl ? (
              <div style={{ marginTop: 12 }}>
                <div style={styles.miniLabel}>Preview</div>
                <video
                  ref={videoRef}
                  style={styles.video}
                  src={previewUrl}
                  controls
                  playsInline
                />
              </div>
            ) : (
              <div style={styles.empty}>
                Nenhum vídeo selecionado ainda.
              </div>
            )}

            <button
              style={{
                ...styles.btn,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
              onClick={analyze}
              disabled={loading}
            >
              {loading ? "Analisando..." : "Analisar com IA"}
            </button>

            {status ? <div style={styles.status}>{status}</div> : null}
            {error ? <div style={styles.error}>{error}</div> : null}

            {cached ? (
              <div style={styles.cached}>✅ Esse vídeo já foi analisado antes (cache).</div>
            ) : null}
          </Card>

          <Card title="Resultado">
            {!result ? (
              <div style={styles.empty}>
                Faça o upload e clique em <b>Analisar com IA</b>.
              </div>
            ) : (
              <>
                <div style={styles.scoreWrap}>
                  <div style={styles.scoreLabel}>Score de viralização</div>
                  <div style={{ ...styles.score, borderColor: scoreColor, color: scoreColor }}>
                    {clamp(result.score_viralizacao, 0, 100)}
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Resumo</div>
                  <div style={styles.text}>{result.resumo}</div>
                </div>

                <div style={styles.twoCols}>
                  <div>
                    <div style={styles.sectionTitle}>Pontos fortes</div>
                    <ul style={styles.ul}>
                      {result.pontos_fortes.map((x, i) => (
                        <li key={i} style={styles.li}>{x}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div style={styles.sectionTitle}>Pontos fracos</div>
                    <ul style={styles.ul}>
                      {result.pontos_fracos.map((x, i) => (
                        <li key={i} style={styles.li}>{x}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Melhorias práticas</div>
                  <ul style={styles.ul}>
                    {result.melhorias_praticas.map((x, i) => (
                      <li key={i} style={styles.li}>{x}</li>
                    ))}
                  </ul>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Ganchos sugeridos</div>
                  <div style={styles.pills}>
                    {result.ganchos.map((x, i) => (
                      <Pill key={i}>{x}</Pill>
                    ))}
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Legendas</div>
                  <div style={styles.pills}>
                    {result.legendas.map((x, i) => (
                      <Pill key={i}>{x}</Pill>
                    ))}
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Hashtags</div>
                  <div style={styles.pills}>
                    {result.hashtags.map((x, i) => (
                      <Pill key={i}>{x}</Pill>
                    ))}
                  </div>
                </div>

                <div style={styles.section}>
                  <div style={styles.sectionTitle}>Observações</div>
                  <div style={styles.text}>{result.observacoes}</div>
                </div>

                <details style={styles.details}>
                  <summary style={styles.summary}>Ver JSON completo</summary>
                  <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre>
                </details>
              </>
            )}
          </Card>
        </div>

        <footer style={styles.footer}>
          ViraCheck AI • Upload → Frames → IA → Score (com cache por vídeo)
        </footer>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "16px",
    background:
      "radial-gradient(1200px 600px at 20% 0%, rgba(45,212,191,0.18), transparent 40%), radial-gradient(1200px 600px at 80% 0%, rgba(96,165,250,0.18), transparent 40%), #070A10",
    color: "#E5E7EB",
    display: "flex",
    justifyContent: "center",
  },
  shell: {
    width: "100%",
    maxWidth: 980,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "flex-start",
    marginBottom: 14,
  },
  h1: { fontSize: 28, fontWeight: 800, letterSpacing: -0.4 },
  sub: { color: "#A1A1AA", marginTop: 6, lineHeight: 1.35 },
  badge: {
    padding: "8px 12px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    fontWeight: 700,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
  },
  card: {
    borderRadius: 18,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(15, 18, 28, 0.72)",
    backdropFilter: "blur(10px)",
    padding: 14,
    boxShadow: "0 14px 40px rgba(0,0,0,0.35)",
  },
  cardTitle: { fontSize: 16, fontWeight: 800, marginBottom: 10 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 12, color: "#A1A1AA" },
  miniLabel: { fontSize: 12, color: "#A1A1AA", marginBottom: 6 },
  inputFile: {
    padding: 10,
    borderRadius: 12,
    border: "1px dashed rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
    color: "#E5E7EB",
  },
  video: {
    width: "100%",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#000",
  },
  btn: {
    marginTop: 12,
    width: "100%",
    padding: "14px 14px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "linear-gradient(90deg, rgba(45,212,191,0.9), rgba(96,165,250,0.9))",
    fontWeight: 900,
    fontSize: 16,
    color: "#041018",
  },
  status: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#D4D4D8",
  },
  error: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(248,113,113,0.10)",
    border: "1px solid rgba(248,113,113,0.25)",
    color: "#FCA5A5",
    whiteSpace: "pre-wrap",
  },
  cached: {
    marginTop: 10,
    padding: "10px 12px",
    borderRadius: 14,
    background: "rgba(45,212,191,0.10)",
    border: "1px solid rgba(45,212,191,0.25)",
    color: "#99F6E4",
  },
  empty: {
    padding: 12,
    borderRadius: 14,
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.10)",
    color: "#A1A1AA",
  },
  scoreWrap: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 },
  scoreLabel: { color: "#A1A1AA", fontSize: 12 },
  score: {
    minWidth: 74,
    textAlign: "center",
    fontSize: 22,
    fontWeight: 900,
    borderRadius: 14,
    padding: "8px 12px",
    border: "2px solid rgba(255,255,255,0.18)",
    background: "rgba(255,255,255,0.04)",
  },
  section: { marginTop: 14 },
  sectionTitle: { fontWeight: 900, marginBottom: 8 },
  text: { color: "#E5E7EB", lineHeight: 1.45 },
  twoCols: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 12,
    marginTop: 14,
  },
  ul: { margin: 0, paddingLeft: 18, color: "#E5E7EB" },
  li: { marginBottom: 6, color: "#E5E7EB" },
  pills: { display: "flex", flexWrap: "wrap", gap: 8 },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "#E5E7EB",
    fontSize: 13,
  },
  details: { marginTop: 14 },
  summary: { cursor: "pointer", color: "#A1A1AA", fontWeight: 800 },
  pre: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    background: "rgba(0,0,0,0.35)",
    border: "1px solid rgba(255,255,255,0.12)",
    overflowX: "auto",
    fontSize: 12,
    color: "#E5E7EB",
  },
  footer: {
    marginTop: 14,
    textAlign: "center",
    color: "#71717A",
    fontSize: 12,
  },
};

// responsivo: 2 colunas no desktop
const mq = window.matchMedia?.("(min-width: 900px)");
if (mq?.matches) {
  styles.grid.gridTemplateColumns = "1fr 1fr";
  styles.twoCols.gridTemplateColumns = "1fr 1fr";
}
