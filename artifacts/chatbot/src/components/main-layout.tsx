import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare, Bot, Wrench, Zap, FolderTree,
  Menu, ChevronRight, Home, ClipboardList, Users,
  Brain, Cpu, Bell, BellRing, ToggleLeft, ToggleRight, Loader2, X
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { apiBase } from "@/lib/api";

export const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: MessageSquare, exact: true, group: "main" },
  { href: "/chatbots", label: "Chatbots", icon: Bot, group: "manage" },
  { href: "/tools", label: "Tools", icon: Wrench, group: "manage" },
  { href: "/skills", label: "Skills", icon: Zap, group: "manage" },
  { href: "/files", label: "Files", icon: FolderTree, group: "manage" },
  { href: "/tool-requests", label: "Yêu cầu Tool", icon: ClipboardList, group: "manage" },
  { href: "/users", label: "Khách hàng", icon: Users, group: "manage" },
  { href: "/ai-brain", label: "Bộ não AI", icon: Brain, group: "ai" },
  { href: "/ai-models", label: "AI Model", icon: Cpu, group: "ai" },
];

function isActive(item: typeof NAV_ITEMS[0], location: string) {
  return item.exact ? location === item.href : location.startsWith(item.href);
}

function NavContent({ location, onClose }: { location: string; onClose?: () => void }) {
  const mainItems = NAV_ITEMS.filter(i => i.group === "main");
  const manageItems = NAV_ITEMS.filter(i => i.group === "manage");
  const aiItems = NAV_ITEMS.filter(i => i.group === "ai");

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const active = isActive(item, location);
    return (
      <Link href={item.href} onClick={onClose}>
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          active
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
        }`}>
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="flex-1">{item.label}</span>
          {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
        </div>
      </Link>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm shrink-0">
            <Home className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">MCP Server</p>
            <p className="text-xs text-sidebar-foreground/50">SmartHomeQ</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
        <div className="space-y-0.5">
          {mainItems.map(item => <NavLink key={item.href} item={item} />)}
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 px-3 pb-1">Quản lý</p>
          {manageItems.map(item => <NavLink key={item.href} item={item} />)}
        </div>
        <div className="space-y-0.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/35 px-3 pb-1">AI Intelligence</p>
          {aiItems.map(item => <NavLink key={item.href} item={item} />)}
        </div>
      </nav>

      <div className="px-3 py-3 border-t border-sidebar-border space-y-1">
        <p className="text-xs text-sidebar-foreground/40">ĐT/Zalo: 0909 167 046</p>
        <a href="https://smarthomeq.tech" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline block">
          smarthomeq.tech ↗
        </a>
      </div>
    </div>
  );
}

/* Bottom tab bar — mobile only */
function BottomNav({ location }: { location: string }) {
  const visible = [NAV_ITEMS[0], NAV_ITEMS[1], NAV_ITEMS[2], NAV_ITEMS[3], NAV_ITEMS[7]]; // Chat, Chatbots, Tools, Skills, Bộ não AI
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-background/95 backdrop-blur-md safe-area-bottom">
      {visible.map(item => {
        const active = isActive(item, location);
        return (
          <Link key={item.href} href={item.href} className="flex-1">
            <div className={`flex flex-col items-center justify-center gap-0.5 py-2 transition-colors ${
              active ? "text-primary" : "text-muted-foreground"
            }`}>
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium leading-none truncate w-full text-center px-0.5">{item.label}</span>
            </div>
          </Link>
        );
      })}
    </nav>
  );
}

/* Bell icon with unread badge + report panel */
function ReportsBell() {
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<Array<{
    id: number; reportDate: string; summary: string;
    actions: string[]; suggestions: string[]; isRead: boolean;
  }>>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetch(`${apiBase()}/admin/ai-brain/reports?limit=5`)
      .then(r => r.json())
      .then((d: { reports: typeof reports; unread: number }) => {
        setUnread(d.unread ?? 0);
        setReports(d.reports ?? []);
      })
      .catch(() => {});
  }, []);

  async function openPanel() {
    setOpen(true);
    if (unread > 0) {
      setLoadingReports(true);
      const d = await fetch(`${apiBase()}/admin/ai-brain/reports?limit=10`).then(r => r.json()).catch(() => ({ reports: [], unread: 0 })) as { reports: typeof reports; unread: number };
      setReports(d.reports);
      setUnread(0);
      await fetch(`${apiBase()}/admin/ai-brain/reports/read-all`, { method: "POST" }).catch(() => {});
      setLoadingReports(false);
    }
  }

  async function generate() {
    setGenerating(true);
    const r = await fetch(`${apiBase()}/admin/ai-brain/reports/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatbotId: 1 }),
    }).then(r => r.json()).catch(() => null) as { summary?: string; reportDate?: string; actions?: string[]; suggestions?: string[]; isRead?: boolean; id?: number } | null;
    if (r) setReports(prev => [r as typeof reports[0], ...prev]);
    setGenerating(false);
  }

  return (
    <>
      <button onClick={() => void openPanel()}
        className="relative flex items-center justify-center h-8 w-8 rounded-full hover:bg-muted transition-colors">
        {unread > 0 ? <BellRing className="h-4.5 w-4.5 text-amber-500 animate-bounce-subtle" /> : <Bell className="h-4.5 w-4.5 text-muted-foreground" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end pt-12 pr-2 sm:pr-4 pointer-events-none">
          <div className="pointer-events-auto w-80 sm:w-96 rounded-2xl border bg-background shadow-2xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
              <Bell className="h-4 w-4 text-primary" />
              <span className="font-semibold text-sm flex-1">Báo cáo hàng ngày</span>
              <button onClick={() => void generate()} disabled={generating}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mr-2">
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}Tạo
              </button>
              <button onClick={() => setOpen(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
            </div>
            <div className="max-h-96 overflow-y-auto divide-y">
              {loadingReports ? (
                <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-primary" /></div>
              ) : reports.length === 0 ? (
                <div className="text-center py-8 text-sm text-muted-foreground">Chưa có báo cáo — nhấn "Tạo" để tạo báo cáo đầu tiên</div>
              ) : (
                reports.map(r => (
                  <div key={r.id} className={`px-4 py-3 space-y-1.5 ${!r.isRead ? "bg-amber-50/50" : ""}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-muted-foreground">{r.reportDate}</span>
                      {!r.isRead && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    </div>
                    <p className="text-sm font-medium leading-snug">{r.summary}</p>
                    {(r.actions ?? []).length > 0 && (
                      <div className="space-y-0.5">
                        {(r.actions ?? []).slice(0, 3).map((a, i) => <p key={i} className="text-xs text-muted-foreground">• {a}</p>)}
                      </div>
                    )}
                    {(r.suggestions ?? []).length > 0 && (
                      <div className="space-y-0.5">
                        {(r.suggestions ?? []).slice(0, 2).map((s, i) => <p key={i} className="text-xs text-blue-600">💡 {s}</p>)}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* AUTO toggle button in header */
function AutoToggle() {
  const [isAuto, setIsAuto] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch(`${apiBase()}/admin/ai-brain/config/1`)
      .then(r => r.json())
      .then((d: { isAutoEnabled?: boolean }) => setIsAuto(d.isAutoEnabled ?? false))
      .catch(() => {});
  }, []);

  async function toggle() {
    setLoading(true);
    const next = !isAuto;
    setIsAuto(next);
    await fetch(`${apiBase()}/admin/ai-brain/config/1`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isAutoEnabled: next }),
    }).catch(() => {});
    setLoading(false);
  }

  return (
    <button onClick={() => void toggle()} disabled={loading}
      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
        isAuto
          ? "bg-green-500/15 text-green-600 border border-green-500/30 hover:bg-green-500/25"
          : "bg-muted text-muted-foreground border hover:bg-muted/70"
      }`}
      title={isAuto ? "AUTO đang BẬT — AI làm việc tự động" : "AUTO đang TẮT"}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> :
        isAuto ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
      AUTO
      {isAuto && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />}
    </button>
  );
}

interface MainLayoutProps {
  children: React.ReactNode;
  title?: string;
  noPadding?: boolean;
}

export function MainLayout({ children, title, noPadding }: MainLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <NavContent location={location} />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        {/* Top header */}
        <header className="flex items-center gap-2 px-3 sm:px-4 h-12 border-b border-border shrink-0 bg-background/95 backdrop-blur-sm">
          {/* Mobile hamburger */}
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border text-sidebar-foreground">
                <NavContent location={location} onClose={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm truncate">{title ?? "MCP Server"}</span>
          </div>

          {/* Bell (báo cáo) — luôn hiển thị bên cạnh "MCP Server" */}
          <ReportsBell />

          <div className="flex-1" />

          {/* AUTO toggle */}
          <AutoToggle />

          {/* Logo small on mobile */}
          <div className="md:hidden w-7 h-7 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <Home className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        </header>

        {/* Main content */}
        <main className={`flex-1 overflow-hidden ${noPadding ? "" : "overflow-y-auto p-3 sm:p-4 md:p-6"} pb-safe md:pb-0`}>
          <div className={noPadding ? "h-full" : undefined}>
            {children}
          </div>
        </main>

        <div className={`shrink-0 md:hidden ${noPadding ? "h-0" : "h-16"}`} />
      </div>

      <BottomNav location={location} />
    </div>
  );
}
