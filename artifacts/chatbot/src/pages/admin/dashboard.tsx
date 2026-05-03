import { useEffect, useState } from "react";
import { Bot, Wrench, Zap, Link2, MessageSquare, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { apiBase } from "@/lib/api";

interface Stats {
  chatbots: number;
  tools: number;
  skills: number;
  connections: number;
  conversations: number;
  activeConnections: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ chatbots: 0, tools: 0, skills: 0, connections: 0, conversations: 0, activeConnections: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [chatbots, tools, skills, connections, conversations] = await Promise.all([
          fetch(`${apiBase()}/admin/chatbots`).then(r => r.json()) as Promise<{ id: number }[]>,
          fetch(`${apiBase()}/admin/tools`).then(r => r.json()) as Promise<{ id: number }[]>,
          fetch(`${apiBase()}/admin/skills`).then(r => r.json()) as Promise<{ id: number }[]>,
          fetch(`${apiBase()}/admin/connections`).then(r => r.json()) as Promise<{ id: number; status: string }[]>,
          fetch(`${apiBase()}/anthropic/conversations`).then(r => r.json()) as Promise<{ id: number }[]>,
        ]);
        setStats({
          chatbots: chatbots.length,
          tools: tools.length,
          skills: skills.length,
          connections: connections.length,
          conversations: conversations.length,
          activeConnections: connections.filter(c => c.status === "connected").length,
        });
      } finally { setLoading(false); }
    };
    void load();
  }, []);

  const cards = [
    { label: "Chatbots", value: stats.chatbots, icon: Bot, color: "text-blue-400", bg: "bg-blue-400/10" },
    { label: "Tools", value: stats.tools, icon: Wrench, color: "text-green-400", bg: "bg-green-400/10" },
    { label: "Skills", value: stats.skills, icon: Zap, color: "text-yellow-400", bg: "bg-yellow-400/10" },
    { label: "Kết nối", value: stats.connections, icon: Link2, color: "text-purple-400", bg: "bg-purple-400/10", sub: `${stats.activeConnections} đang kết nối` },
    { label: "Hội thoại", value: stats.conversations, icon: MessageSquare, color: "text-orange-400", bg: "bg-orange-400/10" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-muted-foreground text-sm">Tổng quan hệ thống MCP chatbot</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {cards.map(card => (
          <Card key={card.label} className="p-4 space-y-2">
            <div className={`w-9 h-9 rounded-lg ${card.bg} flex items-center justify-center`}>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </div>
            <div>
              <div className="text-2xl font-bold">{loading ? "—" : card.value}</div>
              <div className="text-sm text-muted-foreground">{card.label}</div>
              {card.sub && <div className="text-xs text-muted-foreground mt-0.5">{card.sub}</div>}
            </div>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Trạng thái hệ thống</h3>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">API Server</span>
              <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/20">Đang chạy</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Chatbot AI (Claude)</span>
              <Badge variant="default" className="bg-green-500/20 text-green-400 hover:bg-green-500/20">Sẵn sàng</Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Kết nối đang hoạt động</span>
              <Badge variant={stats.activeConnections > 0 ? "default" : "secondary"}>
                {loading ? "—" : stats.activeConnections}
              </Badge>
            </div>
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">Thông tin hệ thống</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Mô hình mặc định</span>
              <span className="font-mono text-xs bg-secondary px-2 py-0.5 rounded">Claude Sonnet</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Website</span>
              <a href="https://smarthomeq.tech" target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">smarthomeq.tech</a>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Zalo/ĐT</span>
              <span className="font-medium">0909 167 046</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Webhook URL</span>
              <code className="text-xs text-blue-400">/api/webhooks/zalo</code>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
