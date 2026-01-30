import { useState } from "react";
import { useNavigate } from "react-router-dom";
import MainDashboard from "../components/MainDashboard";

const DashboardPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const handleSearchByEmail = (email: string) => {
    if (!email.trim()) return;
    navigate(`/search/${encodeURIComponent(email.trim())}`);
  };

  const handleOpenAgent = (id: string) => {
    navigate(`/agent/${encodeURIComponent(id)}`);
  };

  const handleOpenTool = (id: string) => {
    navigate(`/tool/${encodeURIComponent(id)}`);
  };

  return (
    <>
      <section className="hero">
        <h1 className="hero-title">AgentDNA Dashboard</h1>
        <p className="hero-sub">Monitor and manage your autonomous agents securely.</p>

      </section>

      <MainDashboard
        onOpenAgent={handleOpenAgent}
        onOpenTool={handleOpenTool}
        onSearchByEmail={handleSearchByEmail}
        searchValue={query}
        onSearchChange={setQuery}
      />
    </>
  );
};

export default DashboardPage;
