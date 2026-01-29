import { useState } from "react";

export default function App() {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>🚀 ViraCheck AI</h1>
        <p style={styles.subtitle}>
          Analise vídeos e descubra o potencial real de viralização
        </p>

        <input
          type="file"
          accept="video/*"
          style={styles.input}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setVideoUrl(URL.createObjectURL(file));
            }
          }}
        />

        {videoUrl && (
          <video
            src={videoUrl}
            controls
            style={styles.video}
          />
        )}

        <button style={styles.button}>
          Analisar com IA
        </button>

        <div style={styles.info}>
          <strong>Status:</strong> App carregado corretamente ✅
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "linear-gradient(135deg, #7b2ff7, #4facfe)",
    fontFamily: "Arial, sans-serif",
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "#0f172a",
    borderRadius: 16,
    padding: 20,
    color: "#fff",
    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
  },
  title: {
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    textAlign: "center",
    fontSize: 14,
    opacity: 0.8,
    marginBottom: 16,
  },
  input: {
    width: "100%",
    marginBottom: 12,
  },
  video: {
    width: "100%",
    borderRadius: 12,
    marginBottom: 12,
    background: "#000",
  },
  button: {
    width: "100%",
    padding: "12px 0",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold",
    fontSize: 16,
    background: "linear-gradient(90deg, #22c55e, #3b82f6)",
    color: "#fff",
  },
  info: {
    marginTop: 12,
    fontSize: 13,
    opacity: 0.85,
    textAlign: "center",
  },
};
