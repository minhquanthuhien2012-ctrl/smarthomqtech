import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Bot, Wrench, Zap, MessageSquare,
  Menu, X, ChevronRight, Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/chatbots", label: "Chatbots & Kết nối", icon: Bot },
  { href: "/admin/tools", label: "Tools", icon: Wrench },
  { href: "/admin/skills", label: "Skills", icon: Zap },
  { href: "/", label: "Chat", icon: MessageSquare },
];

function NavContent({ location, onClose }: { location: string; onClose?: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Settings className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <p className="font-bold text-sm leading-tight">MCP Admin</p>
            <p className="text-xs text-muted-foreground">SmartHomeQ</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(item => {
          const active = item.exact ? location === item.href : location.startsWith(item.href) && item.href !== "/";
          const isChatLink = item.href === "/";
          return (
            <Link key={item.href} href={item.href} onClick={onClose}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                active
                  ? "bg-primary text-primary-foreground"
                  : isChatLink
                  ? "text-muted-foreground hover:bg-secondary hover:text-foreground border border-dashed border-border mt-2"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}>
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="h-3.5 w-3.5 opacity-60" />}
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="px-4 py-3 border-t">
        <p className="text-xs text-muted-foreground">ĐT/Zalo: 0909 167 046</p>
        <a href="https://smarthomeq.tech" target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">smarthomeq.tech</a>
      </div>
    </div>
  );
}

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground">
        <NavContent location={location} />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-56 bg-sidebar border-sidebar-border text-sidebar-foreground">
              <NavContent location={location} onClose={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <span className="font-semibold text-sm">MCP Admin — SmartHomeQ</span>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
