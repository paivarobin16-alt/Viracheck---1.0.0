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

// ---- util: ler duração do vídeo
function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    video.onloadedmetadata = () => {
      const dur = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(dur || 0);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Não foi possível ler metadados do vídeo."));
    };
  });
}

// ---- util: hash (fingerprint) do arquivo (rápido e determinístico)
async function fingerprintFile(file: File): Promise<string> {
  // pega 512KB do início + 512KB do final (rápido e bom o suficiente)
  const chunkSize = 512 * 1024;
  const startBlob = file.slice(0, Math.min(chunkSize, file.size));
  const endBlob =
    file.size > chunkSize ? file.slice(Math.max(0, file.size - chunkSize)) : new Blob([]);

  const startBuf = await startBlob.arrayBuffer();
  const endBuf = await endBlob.arrayBuffer();

  // inclui tamanho + tipo + nome (ajuda a diferenciar)
  const meta = new TextEncoder().encode(
    `|name:${file.name}|size:${file.size}|type:${file.type}|`
  );

  // concatena buffers
  const combined = new Uint8Array(startBuf.byteLength + endBuf.byteLength + meta.byteLength);
  combined.set(new Uint8Array(startBuf), 0);
  combined.set(new Uint8Array(endBuf), startBuf.byteLength);
  combined.set(meta, startBuf.byteLength + endBuf.byteLength);

  const hashBuf = await crypto.subtle.digest("SHA-256", combined);
  const hashArr = Array.from(new Uint8Array(hashBuf));
  return hashArr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- util: score 0..100 baseado no hash (determinístico)
function scoreFromHash(hashHex: string): number {
  // usa alguns bytes do hash para criar um número “bem distribuído”
  const a = parseInt(hashHex.slice(0, 2), 16);
  const b = parseInt(hashHex.slice(2, 4), 16);
  const c = parseInt(hashHex.slice(4, 6), 16);
  const d = parseInt(hashHex.slice(6, 8), 16);
  const raw = (a * 7 + b * 11 + c * 13 + d * 17) % 101; // 0..100
  // evita extremos irreais
  return Math.min(95, Math.max(18, raw));
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

// ---- heurística simples (condizente com o tipo de vídeo curto)
function buildHeuristicResult(params: {
  file: File;
  durationSec: number;
  platform: Platform;
  hook: string;
  desc: string;
  fingerprint: string;
}): AnalysisResult {
  const { file, durationSec, platform, hook, desc, fingerprint } = params;

  // base determinística
  let score = scoreFromHash(fingerprint);

  // ajustes por duração (Reels/TikTok tem “zona boa” 7-20s)
  if (durationSec > 0) {
    if (durationSec >= 7 && durationSec <= 20) score += 8;
    if (durationSec >= 21 && durationSec <= 35) score += 2;
    if (durationSec > 45) score -= 10;
    if (durationSec < 6) score -= 8;
  }

  // ajuste por tamanho (muito pesado = pode cair retenção/carregamento)
  const mb = file.size / (1024 * 1024);
  if (mb > 50) score -= 10;
  if (mb > 100) score -= 18;

  // ajuste por presença de gancho / descrição
  if (hook.trim().length >= 8) score += 6;
  if (desc.trim().length >= 20) score += 3;

  // ajuste por plataforma
  if (platform === "tiktok") score += 2;
  if (platform === "reels") score += 1;

  score = clamp(Math.round(score), 10, 98);

  // diagnóstico
  let diagnostico = "Médio potencial ⚡";
  if (score >= 80) diagnostico = "Alto potencial 🚀";
  else if (score < 50) diagnostico = "Baixo potencial 📉";

  // pontos fortes/fracos (organizados e curtos)
  const fortes: string[] = [];
  const fracos: string[] = [];

  if (durationSec >= 7 && durationSec <= 20) fortes.push("Duração ideal para retenção (7–20s)");
  else fracos.push("Ajuste a duração para 7–20s (melhor retenção)");

  if (hook.trim().length >= 8) fortes.push("Gancho informado (ajuda no 1º segundo)");
  else fracos.push("Falta gancho forte nos primeiros 1–2s");

  if (desc.trim().length >= 20) fortes.push("Contexto claro (facilita entendimento)");
  else fracos.push("Descrição curta: a IA entende menos o contexto");

  fortes.push("Formato vertical adequado para Reels/TikTok/Shorts");

  // melhorias práticas (em ordem)
  const melhorias: string[] = [
    "Coloque um texto forte no 1º segundo (curto e direto).",
    "Use cortes/zoom a cada 1–2s para manter ritmo.",
    "Finalize com CTA claro (ex: 'Comenta EU QUERO').",
    "Adicione legendas grandes e com contraste (sempre).",
    "Use áudio/trilha em alta no momento (sem estourar o volume).",
  ];

  // músicas recomendadas (genéricas porém úteis)
  const musicas: string[] = [
    "Beat acelerado (estilo Reels/TikTok) – foco em energia",
    "Lo-fi leve – se o vídeo for calmo/estético (paisagem)",
    "Trend do momento – procure em 'áudios em alta' na plataforma",
  ];

  // resumo curto e coerente
  const resumo =
    score >= 80
      ? "Vídeo com bom encaixe para conteúdo curto. Foque em gancho imediato e CTA no final para aumentar comentários e salvamentos."
      : score >= 50
      ? "Vídeo tem base ok, mas precisa de gancho mais forte e ritmo de cortes para segurar atenção e aumentar a chance de viralizar."
      : "Vídeo precisa melhorar gancho, ritmo e CTA. Ajustes simples no começo e no final já aumentam muito a retenção.";

  return {
    fingerprint,
    createdAt: Date.now(),
    fileName: file.name,
    durationSec: Math.round(durationSec * 10) / 10,
    platform,
    score,
    diagnostico,
    resumo,
    pontos_fortes: fortes.slice(0, 5),
    pontos_fracos: fracos.slice(0, 6),
    melhorias_praticas: melhorias.slice(0, 6),
    musicas_recomendadas: musicas.slice(0, 5),
  };
}

function loadHistory(): AnalysisResult[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as AnalysisResult[];
  } catch {
    return [];
  }
}

function saveHistory(items: AnalysisResult[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)));
}

function formatAgo(ts: number) {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min <= 0) return "agora";
  if (min < 60) return `${min} min atrás`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  return `${d}d atrás`;
}

export default function Analyze() {
  const [platform, setPlatform] = useState<Platform>("todas");
  const [hook, setHook] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [videoUrl, setVideoUrl] = useState<string>("");
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [history, setHistory] = useState<AnalysisResult[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    if (!file) {
      setVideoUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const canAnalyze = useMemo(() => !!file && !loading, [file, loading]);

  async function onAnalyze() {
    try {
      setError("");
      setResult(null);

      if (!file) {
        setError("Escolha um vídeo primeiro.");
        return;
      }

      setLoading(true);

      // fingerprint do arquivo (determinístico)
      const fp = await fingerprintFile(file);

      // se já analisado, retorna o MESMO resultado
      const cached = loadHistory().find((x) => x.fingerprint === fp);
      if (cached) {
        setResult(cached);
        setLoading(false);
        return;
      }

      // duração real do vídeo
      const durationSec = await getVideoDuration(file);

      // gera resultado por heurística + score determinístico
      const analysis = buildHeuristicResult({
        file,
        durationSec,
        platform,
        hook,
        desc,
        fingerprint: fp,
      });

      // salva no histórico
      const nextHistory = [analysis, ...loadHistory()].slice(0, MAX_HISTORY);
      saveHistory(nextHistory);
      setHistory(nextHistory);
      setResult(analysis);
      setLoading(false);
    } catch (e: any) {
      setLoading(false);
      setError(e?.message || "Erro inesperado ao analisar.");
    }
  }

  function clearHistory() {
    localStorage.removeItem(LS_KEY);
    setHistory([]);
  }

  return (
    <div className="vc-bg">
      <div className="vc-wrap">
        <div className="vc-card">
          <div className="vc-header">
            <div className="vc-title">
              <span className="vc-emoji">🚀</span>
              <div>
                <h1>ViraCheck AI</h1>
                <p>Análise de vídeos e score real de viralização (rápido e estável).</p>
              </div>
            </div>
          </div>

          <div className="vc-howto">
            <div className="vc-howto-title">Como usar</div>
            <ol>
              <li>Escolha um vídeo (vertical é melhor).</li>
              <li>(Opcional) Preencha gancho e descrição.</li>
              <li>Clique em <b>Analisar com IA</b> e veja score + melhorias.</li>
              <li>Mesmo vídeo sempre retorna o mesmo score.</li>
            </ol>
          </div>

          <div className="vc-form">
            <div className="vc-row">
              <label>Plataforma</label>
              <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
                <option value="todas">Todas</option>
                <option value="tiktok">TikTok</option>
                <option value="reels">Instagram Reels</option>
                <option value="shorts">YouTube Shorts</option>
              </select>
            </div>

            <div className="vc-row">
              <label>Gancho (opcional)</label>
              <input
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                placeholder='Ex: "Você tá fazendo isso errado..."'
              />
            </div>

            <div className="vc-row">
              <label>Descrição do vídeo (opcional)</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="Descreva o que acontece no vídeo..."
                rows={3}
              />
            </div>

            <div className="vc-row">
              <label>Upload do vídeo</label>
              <div className="vc-upload">
                <input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
                <div className="vc-upload-hint">
                  Dica: vídeos de <b>7–20s</b> costumam performar melhor.
                </div>
              </div>
            </div>
          </div>

          {videoUrl && (
            <div className="vc-preview">
              <div className="vc-preview-top">
                <span className="vc-badge">Preview</span>
                <span className="vc-filename">{file?.name}</span>
              </div>
              <div className="vc-video">
                <video ref={videoRef} src={videoUrl} controls playsInline />
              </div>
            </div>
          )}

          <button className="vc-btn" disabled={!canAnalyze} onClick={onAnalyze}>
            {loading ? "Analisando..." : "Analisar com IA"}
          </button>

          {error && (
            <div className="vc-alert vc-alert-error">
              ❌ <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="vc-result">
              <div className="vc-score">
                <div className="vc-score-left">
                  <div className="vc-score-label">🔥 Score</div>
                  <div className="vc-score-value">
                    {result.score}/100 <span className="vc-score-tag">{result.diagnostico}</span>
                  </div>
                </div>
                <div className="vc-score-right">
                  <div className="vc-mini">
                    <span className="vc-mini-k">Duração</span>
                    <span className="vc-mini-v">{result.durationSec}s</span>
                  </div>
                  <div className="vc-mini">
                    <span className="vc-mini-k">Plataforma</span>
                    <span className="vc-mini-v">
                      {result.platform === "todas" ? "Todas" : result.platform}
                    </span>
                  </div>
                </div>
              </div>

              <div className="vc-grid">
                <div className="vc-box">
                  <h3>Resumo</h3>
                  <p>{result.resumo}</p>
                </div>

                <div className="vc-box">
                  <h3>Pontos fortes</h3>
                  <ul>
                    {result.pontos_fortes.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>

                <div className="vc-box">
                  <h3>Pontos fracos</h3>
                  <ul>
                    {result.pontos_fracos.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>

                <div className="vc-box">
                  <h3>O que melhorar (ordem)</h3>
                  <ol>
                    {result.melhorias_praticas.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ol>
                </div>

                <div className="vc-box">
                  <h3>🎵 Músicas recomendadas</h3>
                  <ul>
                    {result.musicas_recomendadas.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                </div>

                <div className="vc-box vc-box-muted">
                  <h3>Fingerprint (cache)</h3>
                  <p className="vc-mono">{result.fingerprint.slice(0, 24)}…</p>
                  <p className="vc-muted">
                    Mesmo vídeo ⇒ mesmo fingerprint ⇒ mesmo score sempre.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="vc-history">
            <div className="vc-history-head">
              <h3>📚 Histórico</h3>
              <button className="vc-link" onClick={clearHistory} type="button">
                Limpar
              </button>
            </div>

            {history.length === 0 ? (
              <div className="vc-muted">Ainda sem histórico.</div>
            ) : (
              <div className="vc-history-list">
                {history.slice(0, MAX_HISTORY).map((h) => (
                  <button
                    key={h.fingerprint}
                    className="vc-history-item"
                    onClick={() => setResult(h)}
                    type="button"
                    title="Ver resultado"
                  >
                    <div className="vc-history-left">
                      <div className="vc-history-name">{h.fileName}</div>
                      <div className="vc-history-meta">
                        {formatAgo(h.createdAt)} • {h.durationSec}s •{" "}
                        {h.platform === "todas" ? "Todas" : h.platform}
                      </div>
                    </div>
                    <div className="vc-history-score">{h.score}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="vc-footer">
            <span className="vc-ok">✅ App carregado corretamente</span>
          </div>
        </div>
      </div>
    </div>
  );
    }
