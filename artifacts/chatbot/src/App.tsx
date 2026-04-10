import { useState } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { ChatSidebar } from "@/components/chat-sidebar";
import { ChatArea } from "@/components/chat-area";

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

function Router() {
  return (
    <Switch>
      <Route path="/" component={ChatInterface} />
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
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
