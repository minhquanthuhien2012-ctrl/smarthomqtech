import { Switch, Route, Router as WouterRouter, Link, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { MessageCircle, Settings, Wrench } from "lucide-react";
import { useState, useEffect } from "react";
import ChatPage from "@/pages/chat";
import ToolsPage from "@/pages/tools";
import WebscraperPage from "@/pages/webscraper";
import LoginPage from "@/pages/login";
import SettingsPage from "@/pages/settings";
import ConnectionsPage from "@/pages/connections";
import NotFound from "@/pages/not-found";
import { fetchMe, getUser, clearToken, type AuthUser } from "@/lib/auth";

const queryClient = new QueryClient();
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function BottomNav() {
  const [location] = useLocation();
  const tabs = [
    { path: "/", label: "Chat", Icon: MessageCircle },
    { path: "/tools", label: "Tool & Skill", Icon: Wrench },
    { path: "/settings", label: "Cài đặt", Icon: Settings },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 flex border-t bg-white z-50 safe-area-bottom">
      {tabs.map(({ path, label, Icon }) => {
        const active = path === "/" ? location === "/" : location.startsWith(path);
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

function AuthenticatedApp({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  return (
    <>
      <div className="pb-14">
        <Switch>
          <Route path="/" component={ChatPage} />
          <Route path="/tools" component={ToolsPage} />
          <Route path="/webscraper" component={WebscraperPage} />
          <Route path="/settings">
            <SettingsPage user={user} onLogout={onLogout} />
          </Route>
          <Route path="/connections" component={ConnectionsPage} />
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

function AppShell() {
  const [user, setUser] = useState<AuthUser | null>(getUser());
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    fetchMe().then(u => {
      setUser(u);
      setChecking(false);
    });
  }, []);

  function handleLogin(u: AuthUser) { setUser(u); }
  function handleLogout() { clearToken(); setUser(null); }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return <AuthenticatedApp user={user} onLogout={handleLogout} />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={BASE}>
          <KeepAlive />
          <AppShell />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
