import { Routes, Route, BrowserRouter, Link, useLocation } from "react-router-dom";
import "./App.css";

import DashboardPage from "./pages/DashboardPage";
import AgentProfilePage from "./pages/AgentProfilePage";
import EmailSearchPage from "./pages/EmailSearchPage";
import logo from "./assets/a4d2293fc03eb10393506a75b7c4bd9ad839d7ba-efzz4AxP.png";
import { useEffect } from "react";
import ToolProfilePage from "./pages/ToolProfile";


export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;


function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant", // or "smooth" if you want
    });
  }, [pathname]);

  return null;
}

function App() {
  return (
    <BrowserRouter>
          <ScrollToTop />

      <div className="page">
        <header className="nav">
          {/* Left: Logo */}
          <Link to="/" className="brand">
            <img src={logo} alt="AgentDNA Logo" className="brand-logo" />
          </Link>
          {/* <div className="brand">
            <img src={logo} alt="AgentDNA Logo" className="brand-logo" />
          </div> */}

          {/* Right: Actions */}
          <div className="nav-actions">
            {/* <button className="nav-link-btn">Hub</button> */}
            <Link to="https://hub.agentdna.io/" className="nav-link-btn">
              HUB
            </Link>

            <Link to="https://agentdna.io/beta" className="outline">
              Try Beta
            </Link>
          </div>
        </header>

        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/agent/:id" element={<AgentProfilePage />} />
          <Route path="/tool/:id" element={<ToolProfilePage />} />
          <Route path="/search/:email" element={<EmailSearchPage />} />

        </Routes>
      </div>
      <footer className="footer">© 2026 AgentDNA. All rights reserved.</footer>
    </BrowserRouter>
  );
}

export default App;
