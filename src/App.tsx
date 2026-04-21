import { Routes, Route, BrowserRouter, useLocation } from "react-router-dom";
import "./App.css";

import DashboardPage from "./pages/DashboardPage";
import AgentProfilePage from "./pages/AgentProfilePage";
import EmailSearchPage from "./pages/EmailSearchPage";
import ToolProfilePage from "./pages/ToolProfile";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import { useEffect } from "react";

export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}

function AppInner() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <Navbar />
      <ScrollToTop />
      <div className="page" style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agent/:id" element={<AgentProfilePage />} />
          <Route path="/tool/:id" element={<ToolProfilePage />} />
          <Route path="/search/:email" element={<EmailSearchPage />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;
