import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { MainLayout } from "@/components/main-layout";
import { AgentPopup } from "@/components/agent-popup";
import ChatPage from "@/pages/chat-page";
import FilesPage from "@/pages/files-page";
import ChatbotsPage from "@/pages/admin/chatbots";
import ToolsPage from "@/pages/admin/tools";
import SkillsPage from "@/pages/admin/skills";
import ConnectionsPage from "@/pages/admin/connections";

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/">
        <MainLayout title="Chat" noPadding>
          <ChatPage />
        </MainLayout>
      </Route>
      <Route path="/chatbots">
        <MainLayout title="Chatbots">
          <ChatbotsPage />
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
      <Route path="/connections">
        <MainLayout title="Kết nối">
          <ConnectionsPage />
        </MainLayout>
      </Route>
      <Route path="/files">
        <MainLayout title="Files" noPadding>
          <FilesPage />
        </MainLayout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
          <AgentPopup />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
