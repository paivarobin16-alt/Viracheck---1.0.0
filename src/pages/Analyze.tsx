import { useEffect, useMemo, useState } from "react";
import { analyzeVideo, VideoAnalysisResult } from "../services/videoAnalysisService";
import { extractFramesFromVideoFile } from "../utils/frameExtractor";
import { makeVideoFingerprint } from "../utils/fingerprint";

type HistoryItem = {
  id: string;
  createdAt: number;
  videoName: string;
  platform: string;
  score: number;
  cached?: boolean;
  title: string;
  caption: string;
  cta: string;
};

const HISTORY_KEY = "viracheck_history_v1";

export default function Analyze() {
  const [tab, setTab] = useState<"analisar" | "historico" | "ajustes">("analisar");

  const [platform, setPlatform] = useState("Todas");
  const [hook, setHook] = useState("");
  const [description, setDescription] = useState("");

  const [videoFile, setVideoFile] = useState<File | null>(null);
  const videoUrl = useMemo(() => (videoFile ? URL.createObjectURL(videoFile) : ""), [videoFile]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<VideoAnalysisResult | null>(null);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 30)));
    } catch {}
  }, [history]);

  useEffect(() => {
    return () => {
      if (videoUrl) URL.revokeObjectURL(videoUrl);
    };
  }, [videoUrl]);

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

      // salva no histórico
      const item: HistoryItem = {
        id: fingerprint,
        createdAt: Date.now(),
        videoName: videoFile.name,
        platform,
        score: data.score,
        cached: data.cached,
        title: data.title,
        caption: data.caption,
        cta: data.cta,
      };

      setHistory((prev) => {
        const filtered = prev.filter((p) => p.id !== item.id);
        return [item, ...filtered].slice(0, 30);
      });

      setTab("analisar");
    } catch (e: any) {
      console.error(e);
      setError(String(e?.message || e));
      setProgress("");
    } finally {
      setLoading(false);
    }
  }

  async function copySummary() {
    if (!result) return;
    const text =
      `Score: ${result.score}/100\n\n` +
      `Título: ${result.title}\n\n` +
      `Legenda: ${result.caption}\n\n` +
      `CTA: ${result.cta}\n\n` +
      `✅ Pontos fortes:\n- ${(result.strengths || []).join("\n- ")}\n\n` +
      `⚠️ Pontos fracos:\n- ${(result.weaknesses || []).join("\n- ")}\n\n` +
      `🔧 Melhorias:\n- ${(result.improvements || []).join("\n- ")}`;

    await navigator.clipboard.writeText(text);
    setProgress("✅ Copiado para a área de transferência!");
    setTimeout(() => setProgress(""), 1800);
  }

  function clearHistory() {
    setHistory([]);
    setProgress("Histórico apagado.");
    setTimeout(() => setProgress(""), 1400);
  }

  return (
    <>
      <div className="container">
        <header className="header">
          <div>
            <h1 className="title">Viracheck AI</h1>
            <p className="subtitle">
              Visual premium • Mobile-first • Upload + frames + cache (mesmo vídeo = mesma resposta)
            </p>
          </div>
          <div className="badge">OpenAI Vision</div>
        </header>

        {/* Conteúdo */}
        {tab === "analisar" && (
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
                  <div style={{ marginTop: 10 }} className="muted">
                    Arquivo: <strong style={{ color: "rgba(255,255,255,.9)" }}>{videoFile.name}</strong>
                  </div>
                  <video className="video" src={videoUrl} controls playsInline />
                  <div className="muted" style={{ marginTop: 8 }}>
                    Dica: iluminação boa + texto legível nos frames melhora a análise.
                  </div>
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

              <label className="label">Gancho (primeiros 1–3s)</label>
              <input
                className="input"
                value={hook}
                onChange={(e) => setHook(e.target.value)}
                placeholder='Ex: "Você está errando isso…"'
              />

              <label className="label">Descrição do vídeo</label>
              <textarea
                className="textarea"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explique o que acontece, texto na tela, objetivo, etc."
              />

              <div className="row" style={{ marginTop: 10 }}>
                <button className="button" onClick={handleAnalyze} disabled={loading}>
                  {loading ? "Analisando…" : "Analisar"}
                </button>
                <button className="button secondaryBtn smallBtn" onClick={() => setTab("historico")} type="button">
                  Histórico
                </button>
              </div>

              {progress && <div className="notice">{progress}</div>}
              {error && <div className="error">{error}</div>}
            </section>

            <section className="card spanAll">
              <h2 className="cardTitle">3) Resultado</h2>

              {!result && <div className="muted">Envie um vídeo e clique em “Analisar”.</div>}

              {result && (
                <>
                  <div className="scoreWrap">
                    <div>
                      <div className="muted">Score de viralização</div>
                      <div className="scoreBig">{result.score}/100</div>
                      <div style={{ marginTop: 6 }}>
                        <span className="chip">
                          {result.cached ? "✅ Cache (igual sempre)" : "🧠 Novo cálculo"}
                        </span>
                      </div>
                    </div>

                    <div className="row" style={{ justifyContent: "flex-end" }}>
                      <button className="button secondaryBtn smallBtn" onClick={copySummary} type="button">
                        Copiar
                      </button>
                      <button className="button secondaryBtn smallBtn" onClick={() => setResult(null)} type="button">
                        Limpar
                      </button>
                    </div>
                  </div>

                  <div className="grid" style={{ marginTop: 12 }}>
                    <div className="block">
                      <h3 className="h3">✅ Pontos fortes</h3>
                      <ul className="ul">
                        {(result.strengths || []).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="block">
                      <h3 className="h3">⚠️ Pontos fracos</h3>
                      <ul className="ul">
                        {(result.weaknesses || []).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="block spanAll">
                      <h3 className="h3">🔧 Melhorias</h3>
                      <ul className="ul">
                        {(result.improvements || []).map((x, i) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="block">
                      <h3 className="h3">🧠 Título</h3>
                      <div style={{ color: "rgba(255,255,255,.9)" }}>{result.title}</div>
                    </div>

                    <div className="block">
                      <h3 className="h3">✍️ Legenda</h3>
                      <div style={{ color: "rgba(255,255,255,.9)" }}>{result.caption}</div>
                    </div>

                    <div className="block spanAll">
                      <h3 className="h3">📣 CTA</h3>
                      <div style={{ color: "rgba(255,255,255,.9)" }}>{result.cta}</div>
                    </div>

                    {!!result.frame_insights?.length && (
                      <div className="block spanAll">
                        <h3 className="h3">🖼️ Insights dos frames</h3>
                        <ul className="ul">
                          {result.frame_insights.map((x, i) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {tab === "historico" && (
          <div className="grid">
            <section className="card spanAll">
              <h2 className="cardTitle">Histórico (últimos 30)</h2>

              <div className="row">
                <button className="button secondaryBtn smallBtn" onClick={() => setTab("analisar")} type="button">
                  Voltar
                </button>
                <button className="button secondaryBtn smallBtn" onClick={clearHistory} type="button">
                  Apagar tudo
                </button>
              </div>

              {progress && <div className="notice">{progress}</div>}

              {history.length === 0 ? (
                <div className="muted" style={{ marginTop: 12 }}>
                  Ainda não há análises salvas.
                </div>
              ) : (
                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {history.map((h) => (
                    <div key={h.id} className="block">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                        <div>
                          <div style={{ fontWeight: 900 }}>{h.videoName}</div>
                          <div className="muted">
                            {new Date(h.createdAt).toLocaleString("pt-BR")} • {h.platform}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 950, fontSize: 18 }}>{h.score}/100</div>
                          <div className="muted">{h.cached ? "Cache" : "Novo"}</div>
                        </div>
                      </div>

                      <div style={{ marginTop: 10 }} className="muted">
                        <strong style={{ color: "rgba(255,255,255,.9)" }}>Título:</strong> {h.title}
                      </div>
                      <div style={{ marginTop: 6 }} className="muted">
                        <strong style={{ color: "rgba(255,255,255,.9)" }}>CTA:</strong> {h.cta}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {tab === "ajustes" && (
          <div className="grid">
            <section className="card spanAll">
              <h2 className="cardTitle">Ajustes</h2>
              <div className="muted">
                (Aqui você pode adicionar mais opções depois: limite de frames, modo pro, idiomas, etc.)
              </div>
              <div className="row" style={{ marginTop: 12 }}>
                <button className="button secondaryBtn smallBtn" onClick={() => setTab("analisar")} type="button">
                  Voltar
                </button>
              </div>
            </section>
          </div>
        )}

        <div className="mobileSpacer" />
        <footer className="footer">
          <span>© {new Date().getFullYear()} Viracheck AI</span>
          <span>•</span>
          <span>Mobile-first</span>
          <span>•</span>
          <span>Histórico + Copiar</span>
        </footer>
      </div>

      {/* Bottom Nav (mobile) */}
      <div className="bottomNav">
        <div className="bottomNavInner">
          <button
            className={`tabBtn ${tab === "analisar" ? "tabBtnActive" : ""}`}
            onClick={() => setTab("analisar")}
            type="button"
          >
            Analisar
          </button>
          <button
            className={`tabBtn ${tab === "historico" ? "tabBtnActive" : ""}`}
            onClick={() => setTab("historico")}
            type="button"
          >
            Histórico
          </button>
          <button
            className={`tabBtn ${tab === "ajustes" ? "tabBtnActive" : ""}`}
            onClick={() => setTab("ajustes")}
            type="button"
          >
            Ajustes
          </button>
        </div>
      </div>
    </>
  );
}
