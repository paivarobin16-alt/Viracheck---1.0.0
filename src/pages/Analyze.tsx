import { useEffect, useMemo, useState } from "react";

/* =========================
   TIPOS
========================= */
type Analysis = {
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

type Frame = {
  t: number;
  image: string;
};

/* =========================
   UTILIDADES
========================= */
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeArray(v: any): string[] {
  return Array.isArray(v) ? v.map(String).filter(Boolean) : [];
}

function normalizeResult(json: any): Analysis {
  const r = json?.result ?? json ?? {};
  return {
    criterios: r.criterios,
    score_viralizacao: Number(r.score_viralizacao || 0),
    resumo: r.resumo || "",
    pontos_fortes: safeArray(r.pontos_fortes),
    pontos_fracos: safeArray(r.pontos_fracos),
    melhorias_praticas: safeArray(r.melhorias_praticas),
    ganchos: safeArray(r.ganchos),
    legendas: safeArray(r.legendas),
    hashtags: safeArray(r.hashtags),
    observacoes: r.observacoes || "",
  };
}

/* =========================
   HASH DO VÍDEO (CACHE)
========================= */
async function sha256File(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function cacheKey(hash: string) {
  return `viracheck:v2:${hash}`;
}

function loadCache(hash: string): Analysis | null {
  try {
    const raw = localStorage.getItem(cacheKey(hash));
    return raw ? normalizeResult(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function saveCache(hash: string, data: Analysis) {
  try {
    localStorage.setItem(cacheKey(hash), JSON.stringify({ result: data }));
  } catch {}
}

/* =========================
   EXTRAÇÃO DE FRAMES (6)
========================= */
async function extractFrames(
  file: File,
  frameCount = 6,
  targetW = 420,
  quality = 0.7
): Promise<Frame[]> {
  const video = document.createElement("video");
  video.src = URL.createObjectURL(file);
  video.muted = true;
  video.playsInline = true;

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("Erro ao carregar vídeo"));
  });

  await new Promise<void>((resolve) => {
    video.onloadeddata = () => resolve();
    setTimeout(resolve, 700);
  });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado");

  const vw = video.videoWidth || 1280;
  const vh = video.videoHeight || 720;
  const scale = targetW / vw;

  canvas.width = targetW;
  canvas.height = Math.round(vh * scale);

  const duration = video.duration || 1;
  const percents = [0.05, 0.18, 0.35, 0.55, 0.72, 0.9];

  const frames: Frame[] = [];

  for (const p of percents.slice(0, frameCount)) {
    const t = Math.min(duration * p, duration - 0.15);
    video.currentTime = t;

    await new Promise<void>((resolve) => {
      const done = () => {
        video.removeEventListener("seeked", done);
        resolve();
      };
      video.addEventListener("seeked", done);
      setTimeout(done, 600);
    });

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    frames.push({ t, image: canvas.toDataURL("image/jpeg", quality) });
  }

  URL.revokeObjectURL(video.src);
  return frames;
}

/* =========================
   COMPONENTE
========================= */
export default function Analyze() {
  const [video, setVideo] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [hash, setHash] = useState("");

  useEffect(() => {
    if (video) {
      setVideoUrl(URL.createObjectURL(video));
    }
  }, [video]);

  async function handleAnalyze(force = false) {
    if (!video) {
      setMsg("Selecione um vídeo.");
      return;
    }

    setMsg("");
    setLoading(true);

    try {
      const videoHash = await sha256File(video);
      setHash(videoHash);

      if (!force) {
        const cached = loadCache(videoHash);
        if (cached) {
          setAnalysis(cached);
          setMsg("Resultado carregado do cache.");
          setLoading(false);
          return;
        }
      }

      const frames = await extractFrames(video);

      const video_meta = {
        name: video.name,
        size: video.size,
        type: video.type,
      };

      const resp = await fetch("/api/analyzeVideo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          frames,
          video_meta,
          video_hash: videoHash,
        }),
      });

      const raw = await resp.text();
      const parsed = JSON.parse(raw);

      if (!resp.ok) {
        throw new Error(parsed?.error || "Erro da API");
      }

      const result = normalizeResult(parsed);
      setAnalysis(result);
      saveCache(videoHash, result);
      setMsg("Análise concluída.");
    } catch (e: any) {
      setMsg("Erro: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  const score = clamp(analysis?.score_viralizacao || 0, 0, 100);

  return (
    <div style={{ padding: 16, color: "white", background: "#0b0d12", minHeight: "100vh" }}>
      <h1 style={{ fontWeight: 900 }}>🎬 Viracheck AI</h1>
      <p>Análise consistente: mesmo vídeo → mesmo score</p>

      <input
        type="file"
        accept="video/*"
        onChange={(e) => {
          setVideo(e.target.files?.[0] || null);
          setAnalysis(null);
          setMsg("");
        }}
      />

      {videoUrl && <video src={videoUrl} controls style={{ width: "100%", marginTop: 12 }} />}

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => handleAnalyze(false)}>Analisar</button>
        <button onClick={() => handleAnalyze(true)}>Reanalisar</button>
      </div>

      {loading && <p>⏳ Analisando...</p>}
      {msg && <p>{msg}</p>}

      {analysis && (
        <div style={{ marginTop: 16 }}>
          <h2>Score: {score}/100</h2>
          <p>{analysis.resumo}</p>

          <h3>Pontos fortes</h3>
          <ul>{analysis.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>

          <h3>Pontos fracos</h3>
          <ul>{analysis.pontos_fracos.map((p, i) => <li key={i}>{p}</li>)}</ul>

          <h3>Melhorias</h3>
          <ul>{analysis.melhorias_praticas.map((p, i) => <li key={i}>{p}</li>)}</ul>

          <h3>Ganchos</h3>
          <ul>{analysis.ganchos.map((p, i) => <li key={i}>{p}</li>)}</ul>

          <h3>Legendas</h3>
          <ul>{analysis.legendas.map((p, i) => <li key={i}>{p}</li>)}</ul>

          <h3>Hashtags</h3>
          <p>{analysis.hashtags.join(" ")}</p>

          <small>Hash do vídeo: {hash}</small>
        </div>
      )}
    </div>
  );
}

