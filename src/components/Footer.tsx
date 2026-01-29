export default function Footer() {
  return (
    <footer
      style={{
        width: "100%",
        textAlign: "center",
        padding: "16px 8px",
        background: "#020617",
        color: "#94a3b8",
        fontSize: 13,
      }}
    >
      <div style={{ marginBottom: 6 }}>
        © {new Date().getFullYear()} ViraCheck AI
      </div>

      <div>
        <a
          href="/privacy"
          style={{
            color: "#60a5fa",
            textDecoration: "none",
            marginRight: 12,
          }}
        >
          Política de Privacidade
        </a>

        <a
          href="mailto:luxecharms1.0@gmail.com"
          style={{
            color: "#60a5fa",
            textDecoration: "none",
          }}
        >
          Contato
        </a>
      </div>
    </footer>
  );
}
