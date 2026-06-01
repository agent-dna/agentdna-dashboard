import { useEffect } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon, type IconName } from "./components/Icon";
import logoMark from "./assets/agentdna-logo.png";
import { Drawer } from "./components/Drawer";
import { TweaksPanel } from "./components/TweaksPanel";
import { EntityDetail } from "./components/drawer/EntityDetail";
import { InteractionDetail } from "./components/drawer/InteractionDetail";
import { IntentDetail } from "./components/drawer/IntentDetail";
import { useDrawer } from "./context/DrawerContext";
import { useTweaks } from "./context/TweaksContext";
import { useAuth } from "./context/AuthContext";
import { useAlerts } from "./data/hooks";
import { initials } from "./lib/format";
import type { Agent, Tool, Intent, Interaction } from "./types";

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  badge?: number;
}

export function App() {
  const { tweaks, setTweak } = useTweaks();
  const { drawer, closeDrawer } = useDrawer();
  const { data: alerts } = useAlerts();
  const { user, logout } = useAuth();
  const location = useLocation();

  const NAV_WORKSPACE: NavEntry[] = [
    { to: "/", label: "Home", icon: "home" },
    { to: "/intents", label: "Intents", icon: "intents" },
    { to: "/agents", label: "Agents & Tools", icon: "agents" },
    { to: "/graph", label: "Flow", icon: "activity" },
    { to: "/requests", label: "Requests", icon: "box" },
    { to: "/interactions", label: "Interactions", icon: "interactions" },
    { to: "/alerts", label: "Threats", icon: "alerts", badge: alerts.length || undefined },
  ];

  const collapsed = tweaks.sidebar === "collapsed";
  const densityClass =
    tweaks.density === "compact" ? "density-compact" : tweaks.density === "comfortable" ? "density-comfy" : "";

  const breadcrumb = (() => {
    const item = NAV_WORKSPACE.find((n) => n.to === location.pathname) ?? NAV_WORKSPACE[0];
    return item.label;
  })();

  useEffect(() => {
    const value = `"${tweaks.font}", system-ui, -apple-system, sans-serif`;
    document.documentElement.style.setProperty("--font-body", value);
    return () => {
      document.documentElement.style.removeProperty("--font-body");
    };
  }, [tweaks.font]);

  return (
    <div className={`app ${collapsed ? "collapsed" : ""} ${densityClass}`.trim()}>
      <aside className="sidebar">
          <img src={logoMark} alt="AgentDNA" className="brand-full" />
        <nav className="sb-nav">
          <div className="sb-section">Workspace</div>
          {NAV_WORKSPACE.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === "/"}
              className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
              title={n.label}
            >
              <Icon className="icon" name={n.icon} size={18} />
              <span className="label">{n.label}</span>
              {n.badge != null && <span className="badge">{n.badge}</span>}
            </NavLink>
          ))}

          <div style={{ flex: 1 }} />
          <div className="sb-section">Account</div>
          <div className="sb-item" title="Sign out" onClick={logout}>
            <Icon className="icon" name="arrowRight" size={18} />
            <span className="label">Sign out</span>
          </div>
        </nav>
        <div className="sb-foot">
          <div className="avatar">{user ? initials(user.email) : "—"}</div>
          <div className="who">
            {user?.email || "Guest"}
            <div className="sub">{user?.org_id || ""}</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <button
            className="icon-btn"
            onClick={() => setTweak("sidebar", collapsed ? "expanded" : "collapsed")}
            title="Toggle sidebar"
          >
            <Icon name="sidebar" size={16} />
          </button>
          <div className="crumbs">
            <span style={{ textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.04em", color: "var(--fg)" }}>
              {user?.org_id || "Organization"}
            </span>
            <span className="sep">/</span>
            <span className="here">{breadcrumb}</span>
          </div>
          <div className="search">
            <Icon name="search" className="icon" size={16} />
            <input placeholder="Search agents, tools, intents…" />
          </div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Outlet />
        </div>
      </div>

      <Drawer open={!!drawer} onClose={closeDrawer}>
        {drawer?.kind === "agent" && <EntityDetail entity={drawer.entity as Agent} kind="agent" />}
        {drawer?.kind === "tool" && <EntityDetail entity={drawer.entity as Tool} kind="tool" />}
        {drawer?.kind === "interaction" && <InteractionDetail interaction={drawer.entity as Interaction} />}
        {drawer?.kind === "intent" && <IntentDetail intent={drawer.entity as Intent} />}
      </Drawer>

      <TweaksPanel />
    </div>
  );
}

export default App;
