import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon, type IconName } from "./components/Icon";
import logoMark from "./assets/agentdna-logo.png";
import { Drawer } from "./components/Drawer";
import { TweaksPanel } from "./components/TweaksPanel";
import { EntityDetail } from "./components/drawer/EntityDetail";
import { InteractionDetail } from "./components/drawer/InteractionDetail";
import { IntentDetail } from "./components/drawer/IntentDetail";
import { SearchDropdown } from "./components/SearchDropdown";
import { useDrawer } from "./context/DrawerContext";
import { useTweaks } from "./context/TweaksContext";
import { useAuth } from "./context/AuthContext";
import { listAgentCreationRequests, listAccessRequestsForOrg } from "./api/requests";
import { fetchSearch, type SearchResults } from "./data/api";
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
  const { user } = useAuth();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) { setSearchResults(null); setSearchOpen(false); return; }
    setSearchOpen(true);
    setSearchLoading(true);
    const timer = setTimeout(() => {
      fetchSearch(q)
        .then(setSearchResults)
        .catch(() => setSearchResults({ agents: [], apps: [], intents: [] }))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (!user?.is_admin) return;
    Promise.all([listAgentCreationRequests(1), listAccessRequestsForOrg(1)])
      .then(([creation, access]) => {
        const count =
          creation.requestsList.filter((r) => r.status === "pending").length +
          access.requestsList.filter((r) => r.status === "pending").length;
        setPendingCount(count);
      })
      .catch(() => {});
  }, [user]);

  const NAV_WORKSPACE: NavEntry[] = [
    { to: "/dashboard", label: "Home", icon: "home" },
    { to: "/intents", label: "Intents", icon: "intents" },
    { to: "/agents", label: "Agents & Apps", icon: "agents" },
    { to: "/graph", label: "Flow", icon: "activity" },
    { to: "/requests", label: "Requests", icon: "box", badge: pendingCount > 0 ? pendingCount : undefined },
    { to: "/interactions", label: "Interactions", icon: "interactions" },
  ];

  const collapsed = tweaks.sidebar === "collapsed";
  const densityClass =
    tweaks.density === "compact" ? "density-compact" : tweaks.density === "comfortable" ? "density-comfy" : "";

  const breadcrumb = (() => {
    if (location.pathname === "/profile") return "Profile";
    return NAV_WORKSPACE.find((n) => location.pathname.startsWith(n.to))?.label ?? "Home";
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
              end={n.to === "/requests"}
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
          <NavLink
            to="/profile"
            className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
            title="Profile"
          >
            <Icon className="icon" name="user" size={18} />
            <span className="label">Profile</span>
          </NavLink>
        </nav>
        <div className="sb-foot">
          <div className="who">
            {user ? (user.name || (user.is_admin ? user.email : user.email.split("@")[0])) : "Guest"}
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
          <div className="search" style={{ position: "relative" }}>
            <Icon name="search" className="icon" size={16} />
            <input
              placeholder="Search agents, tools, intents…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => { if (searchQuery.trim()) setSearchOpen(true); }}
            />
            {searchOpen && (
              <SearchDropdown
                query={searchQuery}
                results={searchResults}
                loading={searchLoading}
                onClose={() => { setSearchOpen(false); setSearchQuery(""); }}
              />
            )}
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

      {/* <TweaksPanel /> */}
    </div>
  );
}

export default App;
