import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/api";

interface AiStaffConfig {
  name: string;
  description: string;
  model: string;
  style: string[];
  responseRules: string[];
  systemPrompt: string;
  tools: Array<{ name: string; description: string }>;
  dynamicContext: string[];
}

export default function AiStaffPage() {
  const [config, setConfig] = useState<AiStaffConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPrompt, setShowPrompt] = useState(false);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase()}/admin/ai-staff`);
      if (!response.ok) throw new Error("Không thể tải cấu hình AI");
      setConfig(await response.json() as AiStaffConfig);
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Không thể tải cấu hình AI",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function copyPrompt() {
    if (!config) return;
    void navigator.clipboard.writeText(config.systemPrompt);
    toast({ title: "Đã sao chép System Prompt" });
  }

  if (loading) {
    return (
      <div className="flex min-h-64 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-8 text-center">
        <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">Chưa tải được cấu hình nhân viên AI.</p>
        <Button variant="outline" className="mt-4" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Thử lại
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Quản lý nhân viên AI
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Xem phong cách và cách trả lời của AI đang chạy trên website SmartHomeQ.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Tải lại
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b bg-primary/5 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold">{config.name}</h2>
            <p className="text-sm text-muted-foreground">{config.description}</p>
          </div>
          <Badge variant="default">{config.model}</Badge>
          <Badge variant="outline">Đang dùng trên web</Badge>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2">
          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <Sparkles className="h-4 w-4 text-primary" /> Phong cách
            </h3>
            <ul className="space-y-2">
              {config.style.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <h3 className="mb-3 flex items-center gap-2 font-semibold">
              <FileText className="h-4 w-4 text-primary" /> Cách trả lời
            </h3>
            <ul className="space-y-2">
              {config.responseRules.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm leading-relaxed">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Wrench className="h-4 w-4 text-primary" /> Công cụ AI được phép dùng
          </h3>
          <div className="space-y-2">
            {config.tools.map((tool) => (
              <div key={tool.name} className="rounded-xl border bg-muted/20 p-3">
                <p className="font-mono text-xs font-semibold">{tool.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{tool.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 flex items-center gap-2 font-semibold">
            <Bot className="h-4 w-4 text-primary" /> Dữ liệu cá nhân hóa
          </h3>
          <ul className="space-y-2">
            {config.dynamicContext.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm leading-relaxed">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 p-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">System Prompt đang áp dụng</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Đây là cấu hình nền. Tên người dùng, prompt tùy chỉnh và bộ nhớ được ghép thêm theo từng tài khoản.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={copyPrompt}>
            <Copy className="mr-2 h-4 w-4" /> Sao chép
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowPrompt((value) => !value)}>
            {showPrompt ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
        {showPrompt && (
          <pre className="max-h-[28rem] overflow-auto border-t bg-muted/30 p-4 text-xs leading-relaxed whitespace-pre-wrap">
            {config.systemPrompt}
          </pre>
        )}
      </Card>
    </div>
  );
}