import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  MessageSquare, Bot, Wrench, Zap, Link2, FolderTree,
  Menu, ChevronRight, Home, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export const NAV_ITEMS = [
  { href: "/", label: "Chat", icon: MessageSquare, exact: true, group: "main" },
  { href: "/chatbots", label: "Chatbots", icon: Bot, group: "manage" },
  { href: "/tools", label: "Tools", icon: Wrench, group: "manage" },
  { href: "/skills", label: "Skills", icon: Zap, group: "manage" },
  { href: "/connections", label: "Kết nối", icon: Link2, group: "manage" },
  { href: "/files", label: "Files", icon: FolderTree, group: "manage" },
];

function NavContent({ location, onClose }: { location: string; onClose?: () => void }) {
  const mainItems = NAV_ITEMS.filter(i => i.group === "main");
  const manageItems = NAV_ITEMS.filter(i => i.group === "manage");

  const NavLink = ({ item }: { item: typeof NAV_ITEMS[0] }) => {
    const active = item.exact
      ? location === item.href
      : location.startsWith(item.href);
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
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-sm">
            <Home className="h-4.5 w-4.5 text-primary-foreground" />
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
      <aside className="hidden md:flex w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
        <NavContent location={location} />
      </aside>

      <div className="flex flex-col flex-1 min-w-0">
        <header className="flex items-center gap-3 px-4 h-12 border-b border-border shrink-0 bg-background/80 backdrop-blur-sm">
          <div className="md:hidden">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0 w-56 bg-sidebar border-sidebar-border text-sidebar-foreground">
                <NavContent location={location} onClose={() => setMobileOpen(false)} />
              </SheetContent>
            </Sheet>
          </div>
          <span className="font-semibold text-sm text-foreground">{title ?? "MCP Server"}</span>
          <div className="flex-1" />
          <Settings2 className="h-4 w-4 text-muted-foreground" />
        </header>

        <main className={`flex-1 overflow-hidden ${noPadding ? "" : "overflow-y-auto p-4 md:p-6"}`}>
          {children}
        </main>
      </div>
    </div>
  );
}
