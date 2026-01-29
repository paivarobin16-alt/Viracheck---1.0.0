import Analyze from "./pages/Analyze";
import Footer from "./components/Footer";

export default function App() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Conteúdo principal */}
      <div style={{ flex: 1 }}>
        <Analyze />
      </div>

      {/* Rodapé (não interfere no app) */}
      <Footer />
    </div>
  );
}
