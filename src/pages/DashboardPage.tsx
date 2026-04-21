import { useNavigate } from "react-router-dom";
import MainDashboard from "../components/MainDashboard";

const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <MainDashboard
      onOpenAgent={(id) => navigate(`/agent/${encodeURIComponent(id)}`)}
      onOpenTool={(id) => navigate(`/tool/${encodeURIComponent(id)}`)}
    />
  );
};

export default DashboardPage;
