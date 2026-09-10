import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import NotFound from "@/pages/not-found";
import { MainLayout } from "@/components/main-layout";
import { AgentPopup } from "@/components/agent-popup";
import ChatPage from "@/pages/chat-page";
import FilesPage from "@/pages/files-page";
import ChatbotsPage from "@/pages/admin/chatbots";
import ToolsPage from "@/pages/admin/tools";
import SkillsPage from "@/pages/admin/skills";
import ToolRequestsPage from "@/pages/admin/tool-requests";
import UsersPage from "@/pages/admin/users";
import AiBrainPage from "@/pages/admin/ai-brain";
import AiModelsPage from "@/pages/admin/ai-models";
import AiStaffPage from "@/pages/admin/ai-staff";
import { useEffect } from "react";
import { apiBase } from "@/lib/api";

const queryClient = new QueryClient();

function KeepAlive() {
  useEffect(() => {
    const ping = () => { fetch(`${apiBase()}/healthz`).catch(() => {}); };
    ping();
    const id = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <MainLayout title="Chat" noPadding>
          <ChatPage />
        </MainLayout>
      </Route>
      <Route path="/chatbots">
        <MainLayout title="Quản lý Chatbot">
          <ChatbotsPage />
        </MainLayout>
      </Route>
      <Route path="/ai-staff">
        <MainLayout title="Quản lý nhân viên AI">
          <AiStaffPage />
        </MainLayout>
      </Route>
      <Route path="/tools">
        <MainLayout title="Tools">
          <ToolsPage />
        </MainLayout>
      </Route>
      <Route path="/skills">
        <MainLayout title="Skills">
          <SkillsPage />
        </MainLayout>
      </Route>
      <Route path="/tool-requests">
        <MainLayout title="Yêu cầu Tool/Skill">
          <ToolRequestsPage />
        </MainLayout>
      </Route>
      <Route path="/files">
        <MainLayout title="Files" noPadding>
          <FilesPage />
        </MainLayout>
      </Route>
      <Route path="/users">
        <MainLayout title="Khách hàng">
          <UsersPage />
        </MainLayout>
      </Route>
      <Route path="/ai-brain">
        <MainLayout title="Bộ não AI">
          <AiBrainPage />
        </MainLayout>
      </Route>
      <Route path="/ai-models">
        <MainLayout title="Quản lý AI Model">
          <AiModelsPage />
        </MainLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <KeepAlive />
            <Router />
            <AgentPopup />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
