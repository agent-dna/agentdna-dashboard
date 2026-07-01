import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import App from "./App";
import { HomePage } from "./pages/HomePage";
import { IntentsPage } from "./pages/IntentsPage";
import { AgentsToolsPage } from "./pages/AgentsToolsPage";
import { AgentDetailPage } from "./pages/AgentDetailPage";
import { IntentDetailPage } from "./pages/IntentDetailPage";
import { InteractionsPage } from "./pages/InteractionsPage";
import { LoginPage } from "./pages/LoginPage";
import { RequestsPage } from "./pages/RequestsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { LandingPage } from "./pages/LockedPage";
// import { LandingPage } from "./pages/LandingPage";
import { FlowPage } from "./pages/flow/FlowPage";
import { DrawerProvider } from "./context/DrawerContext";
import { TweaksProvider } from "./context/TweaksContext";
import { AuthProvider } from "./context/AuthContext";
import { DirectoryProvider } from "./context/DirectoryContext";
import { IntentNumbersProvider } from "./context/IntentNumbersContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <DirectoryProvider>
        <IntentNumbersProvider>
        <TweaksProvider>
          <DrawerProvider>
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route
                element={
                  <ProtectedRoute>
                    <App />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<HomePage />} />
                <Route path="intents" element={<IntentsPage />} />
                <Route path="intents/:intentId" element={<IntentDetailPage />} />
                <Route path="agents" element={<AgentsToolsPage />} />
                <Route path="agents/:agentId" element={<AgentDetailPage />} />
                <Route path="requests" element={<RequestsPage />} />
                <Route path="graph" element={<FlowPage />} />
                <Route path="graph/:intentId" element={<FlowPage />} />
                <Route path="interactions" element={<InteractionsPage />} />
                <Route path="profile" element={<ProfilePage />} />
                {/* <Route path="locked" element={<LockedPage />} /> */}
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Route>
            </Routes>
          </DrawerProvider>
        </TweaksProvider>
        </IntentNumbersProvider>
        </DirectoryProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
