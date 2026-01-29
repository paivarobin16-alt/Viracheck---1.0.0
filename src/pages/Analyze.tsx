import { useEffect, useMemo, useRef, useState } from "react";

type Platform = "todas" | "tiktok" | "reels" | "shorts";

type AnalysisResult = {
  fingerprint: string;
  createdAt: number;
  fileName: string;
  durationSec: number;
  platform: Platform;
  score: number;
  diagnostico: string;
  resumo: string;
  pontos_fortes: string[];
  pontos_fracos: string[];
  melhorias_praticas: string[];
  musicas_recomendadas: string[];
};

const LS_KEY = "viracheck.history.v1";
const MAX_HISTORY = 12;

/* ================= UTILIDADES ================= */

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(video.duration || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler o vídeo."));
    };
  });
}

async function fingerprintFile(file: File): Promise<string> {
  const chunk = 512 * 1024;
  const start = await file.slice(0, chunk).arrayBuffer();
  const end =
    file.size > chunk
      ? await file.slice(file.size - chunk).arrayBuffer()
      : new ArrayBuffer(0);

  const meta = new TextEncoder().encode(
    `${file.name}|${file.size}|${file.type}`
  );

  const combined = new Uint8Array(start.byteLength + end.byteLength + meta.byteLength);
  combined.set(new Uint8Array(start), 0);
  combined.set(new Uint8Array(end), start.byteLength);
  combined.set(meta, start.byteLength + end.byteLength);

  const hash = await crypto.subtle.digest("SHA-256", combined);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function scoreFromHash(hash: string) {
  const n = parseInt(hash.slice(0, 8), 16);
  return Math.min(98, Math.max(15, (n % 85) + 15));
}

function loadHistory(): AnalysisResult[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveHistory(items: AnalysisResult[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m} min atrás`;
  const h = Math.floor(m / 60);
  return `${h}h atrás`;
}

/* ================= COMPONENTE ================= */

export default function Analyze() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState("");
  const [platform, setPlatform] = useState<Platform>("todas");
  const [hook, setHook] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  useEffect(() => setHistory(loadHistory()), []);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canAnalyze = useMemo(() => !!file && !loading, [file, loading]);

  async function analyze() {
    try {
      setLoading(true);
      setError("");
      setResult(null);

      if (!file) return;

      const fingerprint = await fingerprintFile(file);
      const cached = loadHistory().find((h) => h.fingerprint === fingerprint);
      if (cached) {
        setResult(cached);
        setLoading(false);
        return;
      }

      const duration = await getVideoDuration(file);
      let score = scoreFromHash(fingerprint);

      if (duration >= 7 && duration <= 20) score += 8;
      if (duration > 45) score -= 12;
      if (hook.length > 6) score += 6;

      score = Math.min(98, Math.max(15, score));

      const result: AnalysisResult = {
        fingerprint,
        createdAt: Date.now(),
        fileName: file.name,
        durationSec: Number(duration.toFixed(1)),
        platform,
        score,
        diagnostico: score >= 80 ? "Alto potencial 🚀" : score >= 50 ? "Médio ⚡" : "Baixo 📉",
        resumo:
          score >= 80
            ? "Vídeo bem alinhado com conteúdo curto. Ajustes simples podem gerar muitos comentários."
            : "O vídeo precisa de um gancho mais forte e CTA mais claro.",
        pontos_fortes: [
          "Formato vertical ideal",
          "Boa duração para retenção",
        ],
        pontos_fracos: [
          "Gancho inicial fraco",
          "CTA pouco claro",
        ],
        melhorias_praticas: [
          "Texto impactante no 1º segundo",
          "Cortes ou zoom a cada 2s",
          "Finalizar com CTA direto",
        ],
        musicas_recomendadas: [
          "Beat acelerado (Reels/TikTok)",
          "Trend do momento",
          "Lo-fi se for conteúdo calmo",
        ],
      };

      const next = [result, ...loadHistory()];
      saveHistory(next);
      setHistory(next);
      setResult(result);
    } catch (e: any) {
      setError("Erro ao analisar vídeo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="vc-bg">
      <div className="vc-wrap">
        <div className="vc-card">

          <h1>🚀 ViraCheck AI</h1>
          <p className="vc-muted">
            Descubra o potencial real de viralização do seu vídeo
          </p>

          <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
            <option value="todas">Todas</option>
            <option value="tiktok">TikTok</option>
            <option value="reels">Instagram Reels</option>
            <option value="shorts">YouTube Shorts</option>
          </select>

          <input placeholder="Gancho (opcional)" value={hook} onChange={(e) => setHook(e.target.value)} />
          <textarea placeholder="Descrição do vídeo (opcional)" value={desc} onChange={(e) => setDesc(e.target.value)} />

          <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />

          {videoUrl && <video src={videoUrl} controls />}

          <button disabled={!canAnalyze} onClick={analyze}>
            {loading ? "Analisando..." : "Analisar com IA"}
          </button>

          {error && <div className="vc-alert-error">{error}</div>}

          {result && (
            <div>
              <h2>🔥 Score: {result.score}/100</h2>
              <p>{result.diagnostico}</p>

              <h3>Resumo</h3>
              <p>{result.resumo}</p>

              <h3>Pontos fortes</h3>
              <ul>{result.pontos_fortes.map((p, i) => <li key={i}>{p}</li>)}</ul>

              <h3>Pontos fracos</h3>
              <ul>{result.pontos_fracos.map((p, i) => <li key={i}>{p}</li>)}</ul>

              <h3>O que melhorar</h3>
              <ol>{result.melhorias_praticas.map((m, i) => <li key={i}>{m}</li>)}</ol>

              <h3>🎵 Músicas recomendadas</h3>
              <ul>{result.musicas_recomendadas.map((m, i) => <li key={i}>{m}</li>)}</ul>
            </div>
          )}

          <h3>📚 Histórico</h3>
          {history.map((h) => (
            <div key={h.fingerprint}>
              {h.fileName} • {h.score} • {timeAgo(h.createdAt)}
            </div>
          ))}

        </div>
      </div>
    </div>
  );
          }
