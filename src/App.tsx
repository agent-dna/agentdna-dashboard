import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon, type IconName } from "./components/Icon";
import { initials } from "./lib/format";
import logoMark from "./assets/agentdna-logo.png";
import { Drawer } from "./components/Drawer";
import { EntityDetail } from "./components/drawer/EntityDetail";
import { InteractionDetail } from "./components/drawer/InteractionDetail";
import { IntentDetail } from "./components/drawer/IntentDetail";
import { SearchDropdown } from "./components/SearchDropdown";
import { useDrawer } from "./context/DrawerContext";
import { useTweaks } from "./context/TweaksContext";
import { useAuth } from "./context/AuthContext";
import { TopbarSlotContext } from "./context/TopbarSlotContext";
import { useIntentReview } from "./context/IntentReviewContext";
import { listAgentCreationRequests, listAccessRequestsForOrg } from "./api/requests";
import { fetchSearch, type SearchResults } from "./data/api";
import type { Agent, Tool, Intent, Interaction } from "./types";

interface NavEntry {
  to: string;
  label: string;
  icon: IconName;
  badge?: number;
  adminOnly?: boolean;
}

export function App() {
  const { tweaks, setTweak } = useTweaks();
  const { drawer, closeDrawer } = useDrawer();
  const { user } = useAuth();
  const location = useLocation();
  const [topbarSlot, setTopbarSlot] = useState<HTMLDivElement | null>(null);
  const { unacknowledgedCount } = useIntentReview();
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
    { to: "/intents", label: "Intents", icon: "intents", badge: unacknowledgedCount > 0 ? unacknowledgedCount : undefined },
    { to: "/agents", label: "Agents & Apps", icon: "agents" },
    { to: "/observability", label: "Observability", icon: "activity" },
    { to: "/resources", label: "Resources", icon: "globe" },
    { to: "/approvals", label: "Approvals", icon: "box", badge: pendingCount > 0 ? pendingCount : undefined },
    { to: "/users", label: "Users", icon: "user", adminOnly: true },
    // Hidden from the sidebar for now; the /interactions route still works.
    // { to: "/interactions", label: "Interactions", icon: "interactions" },
  ];

  // The flow page needs the width, so the sidebar folds away there and comes back on other pages.
  // Opening it on the flow page lasts for that visit only; the saved preference is untouched.
  const onFlow = location.pathname === "/graph" || location.pathname.startsWith("/graph/");
  const [flowSidebarOpen, setFlowSidebarOpen] = useState(false);
  const [wasOnFlow, setWasOnFlow] = useState(onFlow);
  if (wasOnFlow !== onFlow) {
    setWasOnFlow(onFlow);
    setFlowSidebarOpen(false);
  }
  const collapsed = onFlow ? !flowSidebarOpen : tweaks.sidebar === "collapsed";
  const toggleSidebar = () => {
    if (onFlow) setFlowSidebarOpen((o) => !o);
    else setTweak("sidebar", collapsed ? "expanded" : "collapsed");
  };
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
          <div className="sb-workspace">
            <div className="sb-section">Workspace</div>
            {NAV_WORKSPACE.filter((n) => !n.adminOnly || user?.is_admin).map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === "/approvals"}
                className={({ isActive }) => `sb-item ${isActive ? "active" : ""}`}
                title={n.label}
              >
                <Icon className="icon" name={n.icon} size={18} />
                <span className="label">{n.label}</span>
                {n.badge != null && <span className="badge">{n.badge}</span>}
              </NavLink> 
            ))}
          </div>

          <div className="sb-bottom">
            <div className="sb-section">Account</div>
            <NavLink to="/profile" className="sb-foot" title="Profile" style={{ textDecoration: "none" }}>
              <div className="avatar">{initials(user ? (user.name || user.email) : "Guest")}</div>
              <div className="who">
                {user ? (user.name || (user.is_admin ? user.email : user.email.split("@")[0])) : "Guest"}
                <div className="sub">{user?.org_id || ""}</div>
              </div>
            </NavLink>
          </div>
        </nav>
      </aside>

      <div className="main">
        <div className="topbar">
          <button
            className="icon-btn"
            onClick={toggleSidebar}
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
          <div className="topbar-slot" ref={setTopbarSlot} />
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
          <TopbarSlotContext.Provider value={topbarSlot}>
            <Outlet />
          </TopbarSlotContext.Provider>
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


