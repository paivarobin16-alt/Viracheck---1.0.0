export default function Analyze() {
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 420,
        background: "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: 18,
        padding: 20,
        textAlign: "center",
        color: "white",
      }}
    >
      <h1 style={{ marginTop: 0 }}>📹 Analisar vídeo</h1>

      <p style={{ opacity: 0.75 }}>
        Se você está vendo este card, o React está funcionando corretamente.
      </p>

      <button
        style={{
          width: "100%",
          padding: 14,
          borderRadius: 14,
          border: "none",
          fontWeight: 800,
          cursor: "pointer",
          background: "linear-gradient(135deg,#6cf2c2,#4da9ff)",
          color: "#081014",
        }}
      >
        Enviar vídeo
      </button>
    </div>
  );
}
