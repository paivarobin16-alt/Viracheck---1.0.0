import { useMemo, useState } from "react";

type Analysis = {
  criterios?: {
    hook_impacto: number;
    qualidade_visual: number;
    clareza_mensagem: number;
    legibilidade_texto_legenda: number;
    potencial_engajamento: number;
  };
  score_viralizacao?: number;
  resumo?: string;
  pontos_fortes?: string[];
  pontos_fracos?: string[];
  melhorias_praticas?: string[];
  ganchos?: string[];
  legendas?: string[];
  hashtags?: string[];
  observacoes?: string;
};

type Frame = { t: number; image: string };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function safeArray(v: any): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}
function normalizeResult(anyJson: any): Analysis {
  const r = anyJson?.result ?? anyJson?.data ?? anyJson ?? {};
  return {
    criterios: r.criterios
      ? {
          hook_impacto: Number(r.criterios.hook_impacto || 0),
          qualidade_visual: Number(r.criterios.qualidade_visual || 0),
          clareza_mensagem: Number(r.criterios.clareza_mensagem || 0),
          legibilidade_texto_legenda: Number(r.criterios.legibilidade_texto_legenda || 0),
          potencial_engajamento: Number(r.criterios.potencial_engajamento || 0),
        }
      : undefined,
    score_viralizacao: Number(r.score_viralizacao || 0),
    resumo: typeof r.resumo === "string" ? r.resumo : "",
    pontos_fortes: safeArray(r.pontos_fortes),
    pontos_fracos: safeArray(r.pontos_fracos),
    melhorias_praticas: safeArray(r.melhorias_praticas),
    ganchos: safeArray(r.ganchos),
    legendas: safeArray(r.legendas),
    hashtags: safeArray(r.hashtags),
    observacoes: typeof r.observacoes === "string" ? r.observacoes : "",
  };
}

async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function extractFrames(
  file: File,
  frameCount = 6,
  targetW = 360,
  quality = 0.6
): Promise<Frame[]> {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Falha ao carregar o vídeo."));
  });

  await new Promise<void>((resolve) => {
    video.onloadeddata = () => resolve();
    setTimeout(resolve, 700);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado.");

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const scale = targetW / vw;

  canvas.width = targetW;
  canvas.height = Math.max(1, Math.round(vh * scale));

  const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 1;

  const percents = [0.05, 0.18, 0.35, 0.55, 0.72, 0.9].slice(0, frameCount);
  const frames: Frame[] = [];

  for (const p of percents) {
    const t = Math.min(Math.max(duration * p, 0.08), Math.max(duration - 0.15, 0.08));
    video.currentTime = t;

    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("seeked", done);
        resolve();
      };
      video.addEventListener("seeked", done);
      setTimeout(() => {
        video.removeEventListener("seeked", done);
        resolve();
      }, 700);
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push({ t, image: canvas.toDataURL("image/jpeg", quality) });
  }

  URL.revokeObjectURL(video.src);
  return frames;
}

function LoadingOverlay({ text }: { text: string }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        backdropFilter: "blur(8px)",
        display: "grid",
        placeItems: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        style={{
          width: "min(420px, 100%)",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(14,18,30,0.9)",
          padding: 16,
          boxShadow: "0 20px 80px rgba(0,0,0,0.6)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 18,
              height: 18,
              borderRadius: 999,
              border: "3px solid rgba(255,255,255,0.25)",
              borderTopColor: "rgba(255,255,255,0.95)",
              animation: "spin 0.9s linear infinite",
            }}
          />
          <div style={{ fontWeight: 1000 }}>Processando…</div>
        </div>
        <div style={{ marginTop: 10, opacity: 0.8, fontSize: 13 }}>{text}</div>

        <style>{`@keyframes spin { from { transform: rotate(0deg);} to { transform: rotate(360deg);} }`}</style>
      </div>
    </div>
  );
}

export default function Analyze() {
  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [loading, setLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Preparando…");
  const [message, setMessage] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function handleAnalyze() {
    setMessage("");
    setAnalysis(null);

    if (!videoFile) {
      setMessage("⚠️ Selecione um vídeo antes de analisar.");
      return;
    }

    setLoading(true);

    try {
      setLoadingText("Calculando assinatura do vídeo…");
      const hash = await sha256File(videoFile);

      setLoadingText("Extraindo frames…");
      const frames = await extractFrames(videoFile, 6, 360, 0.6);

      const video_meta = {
        name: videoFile.name,
        size_bytes: videoFile.size,
        type: videoFile.type,
      };

      setLoadingText("Consultando IA (com cache no servidor)…");
      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          hook,
          description,
          video_hash: hash,
          video_meta,
          frames,
        }),
      });

      const raw = await resp.text();
      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error(`API retornou algo que não é JSON (${resp.status}): ${raw.slice(0, 250)}`);
      }

      if (!resp.ok) {
        throw new Error(parsed?.details || parsed?.error || "Erro da API");
      }

      const normalized = normalizeResult(parsed);
      setAnalysis(normalized);

      if (parsed?.cached) {
        setMessage("✅ Já existia análise para esse vídeo. Retornei o mesmo resultado.");
      } else {
        setMessage("✅ Análise criada e salva. Próxima vez esse vídeo retorna igual.");
      }
    } catch (e: any) {
      setMessage(`❌ ${e?.message || String(e)}`);
    } finally {
      setLoading(false);
    }
  }

  const score = clamp(Number(analysis?.score_viralizacao || 0), 0, 100);

  return (
    <div
      style={{
        minHeight: "100vh",
        color: "white",
        background:
          "radial-gradient(1200px 600px at 20% 0%, rgba(96,165,250,0.20), transparent 50%), radial-gradient(900px 600px at 90% 10%, rgba(52,211,153,0.14), transparent 55%), #0b0d12",
        padding: 16,
      }}
    >
      {loading ? <LoadingOverlay text={loadingText} /> : null}

      <div
        style={{
          maxWidth: 900,
          margin: "0 auto",
          borderRadius: 22,
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          padding: 16,
          boxShadow: "0 18px 70px rgba(0,0,0,0.45)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 1000 }}>📹 Viracheck AI — Analisar vídeo</h1>
        <p style={{ margin: "6px 0 0", opacity: 0.75, fontSize: 13 }}>
          Mesmo vídeo = mesmo resultado (cache no servidor).
        </p>

        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <label style={{ fontSize: 12, opacity: 0.75 }}>Plataforma</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,14,24,0.92)",
              color: "white",
              fontWeight: 900,
            }}
          >
            <option value="Todas">Todas</option>
            <option value="TikTok">TikTok</option>
            <option value="Instagram Reels">Instagram Reels</option>
            <option value="YouTube Shorts">YouTube Shorts</option>
            <option value="Kwai">Kwai</option>
          </select>

          <label style={{ fontSize: 12, opacity: 0.75 }}>Gancho (opcional)</label>
          <input
            value={hook}
            onChange={(e) => setHook(e.target.value)}
            placeholder='Ex: "Você tá fazendo isso errado..."'
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,14,24,0.92)",
              color: "white",
            }}
          />

          <label style={{ fontSize: 12, opacity: 0.75 }}>Descrição (opcional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva rapidamente o conteúdo do vídeo…"
            style={{
              width: "100%",
              padding: 12,
              minHeight: 90,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(10,14,24,0.92)",
              color: "white",
              resize: "vertical",
            }}
          />

          <label style={{ fontSize: 12, opacity: 0.75 }}>Upload do vídeo</label>
          <input
            type="file"
            accept="video/*"
            onChange={(e) => {
              setVideoFile(e.target.files?.[0] || null);
              setAnalysis(null);
              setMessage("");
            }}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 14,
              border: "1px dashed rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.04)",
              color: "white",
            }}
          />

          {videoFile && (
            <video
              src={videoUrl}
              controls
              playsInline
              style={{
                width: "100%",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#000",
              }}
            />
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !videoFile}
            style={{
              width: "100%",
              padding: "14px 14px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "linear-gradient(90deg, #34d399 0%, #60a5fa 55%, #a78bfa 100%)",
              color: "#0b1220",
              fontWeight: 1000,
              fontSize: 16,
              opacity: loading || !videoFile ? 0.6 : 1,
            }}
          >
            {loading ? "Analisando..." : "Analisar"}
          </button>

          {message && (
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 14,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.06)",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {analysis && (
        <div style={{ maxWidth: 900, margin: "14px auto 0", display: "grid", gap: 12 }}>
          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 1000, marginBottom: 8 }}>📊 Score: {score}/100</div>

            <div
              style={{
                width: "100%",
                height: 10,
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.10)",
                overflow: "hidden",
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  width: `${score}%`,
                  height: "100%",
                  borderRadius: 999,
                  background: "linear-gradient(90deg, #34d399 0%, #60a5fa 55%, #a78bfa 100%)",
                }}
              />
            </div>

            <div style={{ fontWeight: 1000, marginBottom: 6 }}>🧠 Resumo</div>
            <div style={{ fontSize: 13, lineHeight: 1.45, opacity: 0.95 }}>{analysis.resumo || "—"}</div>
          </div>

          <Section title="✅ Pontos fortes" items={analysis.pontos_fortes} />
          <Section title="⚠️ Pontos fracos" items={analysis.pontos_fracos} />
          <Section title="🛠️ Melhorias práticas" items={analysis.melhorias_praticas} />
          <Section title="🎯 Ganchos" items={analysis.ganchos} />
          <Section title="📝 Legendas" items={analysis.legendas} />

          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 1000, marginBottom: 10 }}>🏷️ Hashtags</div>
            <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.4 }}>
              {safeArray(analysis.hashtags).map((t) => (t.startsWith("#") ? t : `#${t}`)).join(" ")}
            </div>
          </div>

          <div
            style={{
              borderRadius: 18,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 1000, marginBottom: 10 }}>💡 Observações</div>
            <div style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.4 }}>{analysis.observacoes || "—"}</div>
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, items }: { title: string; items?: string[] }) {
  const list = safeArray(items);
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 1000, marginBottom: 10 }}>{title}</div>
      {list.length ? (
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8 }}>
          {list.map((t, i) => (
            <li key={i} style={{ fontSize: 13, opacity: 0.95, lineHeight: 1.35 }}>
              {t}
            </li>
          ))}
        </ul>
      ) : (
        <div style={{ fontSize: 13, opacity: 0.75 }}>Sem itens.</div>
      )}
    </div>
  );
}
