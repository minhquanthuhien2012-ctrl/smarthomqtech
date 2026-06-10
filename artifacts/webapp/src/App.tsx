import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MessageCircle, Settings } from "lucide-react";
import ChatPage from "@/pages/chat";
import ToolsPage from "@/pages/tools";
import WebscraperPage from "@/pages/webscraper";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

const queryClient = new QueryClient();
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function BottomNav() {
  const [location] = useLocation();
  const tabs = [
    { path: "/", label: "Chat", Icon: MessageCircle },
    { path: "/tools", label: "Tool & Skill", Icon: Settings },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 flex border-t bg-white z-50">
      {tabs.map(({ path, label, Icon }) => {
        const active = location === path;
        return (
          <Link key={path} href={path}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-xs font-medium transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}>
            <Icon className={`h-5 w-5 ${active ? "stroke-[2.5px]" : ""}`} />
            {label}
          </Link>
        );
      })}
    </div>
  );
}

function Router() {
  return (
    <>
      <div className="pb-14">
        <Switch>
          <Route path="/" component={ChatPage} />
          <Route path="/tools" component={ToolsPage} />
          <Route path="/webscraper" component={WebscraperPage} />
          <Route component={NotFound} />
        </Switch>
      </div>
      <BottomNav />
    </>
  );
}

function KeepAlive() {
  useEffect(() => {
    const ping = () => fetch(`${BASE}/api/healthz`).catch(() => {});
    const id = setInterval(ping, 4 * 60 * 1000);
    return () => clearInterval(id);
  }, []);
  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={BASE}>
          <KeepAlive />
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
