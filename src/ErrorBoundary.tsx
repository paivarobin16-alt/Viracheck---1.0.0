import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
  stack?: string;
};

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, message: "" };

  static getDerivedStateFromError(error: any): State {
    return {
      hasError: true,
      message: String(error?.message || error),
      stack: String(error?.stack || ""),
    };
  }

  componentDidCatch(error: any, info: any) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{ minHeight: "100vh", padding: 16, background: "#0b0d12", color: "white", fontFamily: "system-ui" }}>
        <h2 style={{ marginTop: 0 }}>🚨 O app quebrou (por isso tela branca)</h2>
        <p style={{ opacity: 0.85 }}>
          Copie essa mensagem e me envie que eu conserto em 1 passo.
        </p>

        <div style={{ padding: 12, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Erro:</div>
          <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{this.state.message}</pre>

          {this.state.stack ? (
            <>
              <div style={{ fontWeight: 900, margin: "12px 0 8px" }}>Stack:</div>
              <pre style={{ whiteSpace: "pre-wrap", margin: 0, opacity: 0.85 }}>{this.state.stack}</pre>
            </>
          ) : null}
        </div>

        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 14,
            width: "100%",
            padding: 12,
            borderRadius: 12,
            border: 0,
            fontWeight: 900,
            cursor: "pointer",
          }}
        >
          Recarregar
        </button>
      </div>
    );
  }
}

