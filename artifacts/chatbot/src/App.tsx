import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatArea } from "@/components/chat-area";
import { ChatPopup } from "@/components/chat-popup";
import { AdminLayout } from "@/components/admin-layout";
import DashboardPage from "@/pages/admin/dashboard";
import ChatbotsPage from "@/pages/admin/chatbots";
import ToolsPage from "@/pages/admin/tools";
import SkillsPage from "@/pages/admin/skills";
import ConnectionsPage from "@/pages/admin/connections";

const queryClient = new QueryClient();

function ChatInterface() {
  const [currentConversationId, setCurrentConversationId] = useState<number | null>(null);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/30">
      <ChatSidebar
        currentId={currentConversationId}
        onSelect={setCurrentConversationId}
      />
      <ChatArea
        conversationId={currentConversationId}
        onConversationCreated={setCurrentConversationId}
      />
    </div>
  );
}

function AdminDashboard() {
  return <AdminLayout><DashboardPage /></AdminLayout>;
}
function AdminChatbots() {
  return <AdminLayout><ChatbotsPage /></AdminLayout>;
}
function AdminTools() {
  return <AdminLayout><ToolsPage /></AdminLayout>;
}
function AdminSkills() {
  return <AdminLayout><SkillsPage /></AdminLayout>;
}
function AdminConnections() {
  return <AdminLayout><ConnectionsPage /></AdminLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatInterface} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/chatbots" component={AdminChatbots} />
      <Route path="/admin/tools" component={AdminTools} />
      <Route path="/admin/skills" component={AdminSkills} />
      <Route path="/admin/connections" component={AdminConnections} />
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
          <ChatPopup />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
