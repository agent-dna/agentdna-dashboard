import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Mail, Bot, Shield, Zap, Network } from "lucide-react";
import EmailPage from "../components/EmailSearchPage";
import { BACKEND_URL } from "../App";

const EmailSearchPage = () => {
  const { email } = useParams<{ email: string }>();
  const navigate = useNavigate();
  const [isLoadingEmail, setIsLoadingEmail] = useState(false);
  const [metricsData, setMetricsData] = useState({
    agentsInteracted: 0,
    totalInteractions: 0,
    intrusions: 0,
    globalAgentsInteracted: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!email) return;
      setIsLoadingEmail(true);
      try {
        const res = await fetch(`${BACKEND_URL}/metrics/${encodeURIComponent(email)}`);
        const json = await res.json();
        if (!json.status) return;
        const data = json.data;
        setMetricsData({
          agentsInteracted: data.total_agents || 0,
          totalInteractions: data.total_interactions || 0,
          intrusions: data.total_intrusions || 0,
          globalAgentsInteracted: data.interacted_tools || 0,
        });
      } catch {
        setMetricsData({ agentsInteracted: 0, totalInteractions: 0, intrusions: 0, globalAgentsInteracted: 0 });
      } finally {
        setIsLoadingEmail(false);
      }
    };
    fetchMetrics();
  }, [email]);

  const handleBack = () => navigate("/");
  const handleOpenAgent = (id: string) =>
    navigate(`/agent/${encodeURIComponent(id)}`, { state: { fromEmailSearch: true, email } });

  if (!email) return null;

  const decodedEmail = decodeURIComponent(email);

  const metrics = [
    {
      icon: <Bot size={20} className="text-primary-fixed" />,
      label: "Agents Deployed",
      value: metricsData.agentsInteracted,
      accent: "text-primary-fixed",
    },
    {
      icon: <Shield size={20} className="text-error" />,
      label: "Intrusions Detected",
      value: metricsData.intrusions,
      accent: "text-error",
    },
    {
      icon: <Zap size={20} className="text-on-surface-variant" />,
      label: "Total Interactions",
      value: metricsData.totalInteractions,
      accent: "text-on-surface",
    },
    {
      icon: <Network size={20} className="text-primary-fixed/70" />,
      label: "Tools Interacted",
      value: metricsData.globalAgentsInteracted,
      accent: "text-on-surface",
    },
  ];

  return (
    <div className="page">
      {/* Back button */}
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-on-surface-variant hover:text-primary-fixed transition-colors mb-8 font-headline text-sm uppercase tracking-wider"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </button>

      {/* Hero */}
      <div className="flex items-center gap-5 mb-10">
        <div className="w-14 h-14 rounded-xl bg-primary-fixed/10 border border-primary-fixed/20 flex items-center justify-center shrink-0">
          <Mail size={28} className="text-primary-fixed" />
        </div>
        <div>
          <p className="text-on-surface-variant text-xs font-headline uppercase tracking-widest mb-1">Agents under</p>
          <h1 className="font-headline text-3xl font-bold text-on-surface leading-tight break-all">
            {isLoadingEmail ? "Loading…" : decodedEmail}
          </h1>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {metrics.map((m, i) => (
          <div
            key={i}
            className="dashboard-card rounded-xl p-5 border border-outline-variant/30 flex flex-col gap-3"
          >
            <div className="flex items-center gap-2 text-on-surface-variant text-xs font-headline uppercase tracking-widest">
              {m.icon}
              {m.label}
            </div>
            <div className={`font-headline text-3xl font-bold ${m.accent}`}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Tabbed detail section */}
      <EmailPage
        email={decodedEmail}
        onBack={handleBack}
        loading={isLoadingEmail}
        onOpenAgent={handleOpenAgent}
      />
    </div>
  );
};

export default EmailSearchPage;
