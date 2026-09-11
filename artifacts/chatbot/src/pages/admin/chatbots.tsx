import { useEffect, useState } from "react";
import {
  Bot,
  Check,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Send,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiBase } from "@/lib/api";
import { useWebhookBase } from "@/hooks/use-webhook-base";

type PlatformKey = "telegram" | "messenger" | "zalo_creator" | "zalo_oa" | "xiaozhi";

interface Platform {
  key: PlatformKey;
  label: string;
  description: string;
  emoji: string;
  fields: Array<{ key: string; label: string; placeholder: string; help?: string }>;
}

interface ChatbotConnection {
  id: number;
  name: string;
  type: string;
  config: Record<string, string>;
  status: string;
  lastConnectedAt: string | null;
  isActive: boolean;
  createdAt: string;
}

const PLATFORMS: Platform[] = [
  {
    key: "telegram",
    label: "Telegram",
    description: "Bot Telegram trả lời khách hàng tự động.",
    emoji: "✈️",
    fields: [
      {
        key: "botToken",
        label: "Bot Token *",
        placeholder: "123456789:AA...",
        help: "Lấy từ BotFather trên Telegram.",
      },
      {
        key: "chatId",
        label: "Chat ID *",
        placeholder: "Ví dụ: 123456789 hoặc @tenkenh",
        help: "Chat ID của người dùng, nhóm hoặc channel mà bot được phép nhắn tin.",
      },
    ],
  },
  {
    key: "messenger",
    label: "Messenger",
    description: "Kết nối Facebook Page Messenger.",
    emoji: "💬",
    fields: [
      { key: "pageToken", label: "Page Access Token", placeholder: "EAA..." },
      { key: "verifyToken", label: "Verify Token", placeholder: "Token xác thực webhook" },
    ],
  },
  {
    key: "zalo_creator",
    label: "Zalo Creator",
    description: "Kết nối bot được tạo trên Zalo Bot.",
    emoji: "🟦",
    fields: [
      {
        key: "accessToken",
        label: "Bot Access Token",
        placeholder: "OA_ID:token",
        help: "Lấy tại chatbot.zalo.me.",
      },
      { key: "secretToken", label: "Secret Token", placeholder: "Secret xác thực webhook" },
    ],
  },
  {
    key: "zalo_oa",
    label: "Zalo OA",
    description: "Kết nối Official Account để chăm sóc khách hàng.",
    emoji: "🟦",
    fields: [
      { key: "oaAccessToken", label: "OA Access Token", placeholder: "Access token của OA" },
      { key: "secretToken", label: "Secret Token", placeholder: "Secret xác thực webhook" },
    ],
  },
  {
    key: "xiaozhi",
    label: "Xiaozhi",
    description: "Kết nối Xiaozhi qua WebSocket.",
    emoji: "🤖",
    fields: [
      {
        key: "wsUrl",
        label: "WebSocket URL",
        placeholder: "wss://api.xiaozhi.me/mcp/?token=...",
      },
    ],
  },
];

const PLATFORM_LABELS: Record<string, string> = {
  telegram: "Telegram",
  messenger: "Messenger",
  zalo_creator: "Zalo Creator",
  zalo_oa: "Zalo OA",
  xiaozhi: "Xiaozhi",
  // Legacy label for records created before this page was redesigned.
  zalo: "Zalo",
};

const STATUS_LABELS: Record<string, string> = {
  connected: "Đang hoạt động",
  disconnected: "Chưa kết nối",
  error: "Lỗi kết nối",
  connecting: "Đang kết nối",
};

const STATUS_COLOR: Record<string, string> = {
  connected: "bg-green-500",
  disconnected: "bg-gray-400",
  error: "bg-red-500",
  connecting: "bg-yellow-400",
};

const EMPTY_FORM = {
  name: "",
  type: "telegram" as PlatformKey,
  config: {} as Record<string, string>,
  isActive: true,
};

function platformFor(type: string) {
  return PLATFORMS.find((platform) => platform.key === type) ?? {
    key: "zalo_oa" as PlatformKey,
    label: "Zalo",
    description: "Kết nối Zalo đã tạo từ phiên bản trước.",
    emoji: "🟦",
    fields: [],
  };
}

export default function ChatbotsPage() {
  const webhookBase = useWebhookBase();
  const { toast } = useToast();
  const [items, setItems] = useState<ChatbotConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testMessages, setTestMessages] = useState<Record<number, string>>({});
  const [testResults, setTestResults] = useState<Record<number, { ok: boolean; message: string }>>({});

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`${apiBase()}/admin/connections`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setItems(await response.json() as ChatbotConnection[]);
    } catch {
      toast({ title: "Không thể tải danh sách chatbot", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ ...EMPTY_FORM, config: {} });
    setOpen(true);
  }

  function openEdit(item: ChatbotConnection) {
    const platform = PLATFORMS.some((entry) => entry.key === item.type)
      ? item.type as PlatformKey
      : "zalo_oa";

    setEditingId(item.id);
    setForm({
      name: item.name,
      type: platform,
      config: item.config ?? {},
      isActive: item.isActive,
    });
    setOpen(true);
  }

  function selectPlatform(type: PlatformKey) {
    setForm((current) => ({ ...current, type, config: {} }));
  }

  async function save() {
    if (!form.name.trim()) return;
    if (form.type === "telegram" && (!form.config.botToken?.trim() || !form.config.chatId?.trim())) {
      toast({
        title: "Telegram cần Bot Token và Chat ID",
        description: "Nhập đủ hai thông tin trước khi lưu và kết nối bot.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const url = editingId
        ? `${apiBase()}/admin/connections/${editingId}`
        : `${apiBase()}/admin/connections`;

      const response = await fetch(url, {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          type: form.type,
          config: form.config,
          isActive: form.isActive,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(error.error ?? "Lưu chatbot thất bại");
      }

      toast({ title: editingId ? "Đã cập nhật chatbot" : "Đã tạo chatbot mới" });
      setOpen(false);
      setEditingId(null);
      setForm({ ...EMPTY_FORM, config: {} });
      await load();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Lưu chatbot thất bại",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: ChatbotConnection) {
    if (!window.confirm(`Xóa chatbot "${item.name}"?`)) return;
    setActingId(item.id);
    await fetch(`${apiBase()}/admin/connections/${item.id}`, { method: "DELETE" });
    toast({ title: "Đã xóa chatbot" });
    await load();
    setActingId(null);
  }

  async function toggle(item: ChatbotConnection) {
    setActingId(item.id);
    await fetch(`${apiBase()}/admin/connections/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !item.isActive }),
    });
    await load();
    setActingId(null);
  }

  async function connect(item: ChatbotConnection) {
    if (item.type === "telegram" && (!item.config.botToken?.trim() || !item.config.chatId?.trim())) {
      toast({
        title: "Chưa đủ cấu hình Telegram",
        description: "Cần có cả Bot Token và Chat ID mới kết nối được.",
        variant: "destructive",
      });
      return;
    }
    setActingId(item.id);
    try {
      const response = await fetch(`${apiBase()}/admin/connections/${item.id}/connect`, { method: "POST" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Kết nối thất bại");
      toast({ title: `Đã kích hoạt ${item.name}` });
      await load();
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : "Kết nối thất bại",
        variant: "destructive",
      });
    } finally {
      setActingId(null);
    }
  }

  async function disconnect(item: ChatbotConnection) {
    setActingId(item.id);
    await fetch(`${apiBase()}/admin/connections/${item.id}/disconnect`, { method: "POST" });
    toast({ title: `Đã ngắt ${item.name}` });
    await load();
    setActingId(null);
  }

  async function sendTestMessage(item: ChatbotConnection) {
    if (item.type !== "telegram") {
      setTestResults((current) => ({
        ...current,
        [item.id]: { ok: false, message: "Hiện chỉ hỗ trợ gửi tin test cho Telegram." },
      }));
      return;
    }

    const message = testMessages[item.id]?.trim() || "Tin nhắn kiểm tra từ SmartHomeQ";
    setTestingId(item.id);
    setTestResults((current) => {
      const next = { ...current };
      delete next[item.id];
      return next;
    });

    try {
      const response = await fetch(`${apiBase()}/admin/connections/${item.id}/test`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Gửi tin test thất bại");

      setTestResults((current) => ({
        ...current,
        [item.id]: { ok: true, message: "Đã gửi tin test thành công. Hãy kiểm tra chat đích." },
      }));
      await load();
    } catch (error) {
      setTestResults((current) => ({
        ...current,
        [item.id]: {
          ok: false,
          message: error instanceof Error ? error.message : "Gửi tin test thất bại",
        },
      }));
    } finally {
      setTestingId(null);
    }
  }

  const selectedPlatform = platformFor(form.type);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold sm:text-2xl">
            <Bot className="h-5 w-5 text-primary" /> Quản lý Chatbot
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tạo và quản lý các bot kết nối với những nền tảng bên ngoài.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Tải lại
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Tạo mới
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PLATFORMS.map((platform) => (
          <button
            key={platform.key}
            type="button"
            onClick={() => {
              setForm({ ...EMPTY_FORM, type: platform.key, config: {} });
              setEditingId(null);
              setOpen(true);
            }}
            className="rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="text-2xl">{platform.emoji}</span>
            <p className="mt-2 font-semibold">{platform.label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{platform.description}</p>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Bot đã tạo</h2>
        <Badge variant="secondary">{items.length}</Badge>
      </div>

      {loading ? (
        <div className="flex min-h-48 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : items.length === 0 ? (
        <Card className="p-10 text-center">
          <Bot className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
          <p className="font-medium">Chưa có chatbot nào</p>
          <p className="mt-1 text-sm text-muted-foreground">Chọn một nền tảng ở trên để tạo bot đầu tiên.</p>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map((item) => (
            <Card key={item.id} className="space-y-4 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xl">
                  {platformFor(item.type).emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-semibold">{item.name}</h3>
                    <Badge variant="outline">{PLATFORM_LABELS[item.type] ?? item.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tạo ngày {new Date(item.createdAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${STATUS_COLOR[item.status] ?? "bg-gray-400"}`} />
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{STATUS_LABELS[item.status] ?? item.status}</span>
                <span>•</span>
                <span>{item.isActive ? "Bot đang bật" : "Bot đang tắt"}</span>
              </div>

              <div className="rounded-xl border bg-muted/20 p-3">
                <div className="flex items-center gap-2">
                  <Send className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold">Gửi tin test</p>
                  {item.type === "telegram" && <Badge variant="secondary" className="text-[10px]">Telegram</Badge>}
                </div>
                {item.type === "telegram" ? (
                  <>
                    <div className="mt-2 flex gap-2">
                      <Input
                        value={testMessages[item.id] ?? ""}
                        onChange={(event) => setTestMessages((current) => ({
                          ...current,
                          [item.id]: event.target.value,
                        }))}
                        placeholder="Tin nhắn kiểm tra từ SmartHomeQ"
                        maxLength={4096}
                        disabled={testingId === item.id}
                        className="h-9 text-sm"
                      />
                      <Button
                        size="sm"
                        onClick={() => void sendTestMessage(item)}
                        disabled={
                          testingId === item.id
                          || !item.config.botToken?.trim()
                          || !item.config.chatId?.trim()
                        }
                      >
                        {testingId === item.id
                          ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                          : <Send className="mr-1.5 h-3.5 w-3.5" />}
                        Gửi
                      </Button>
                    </div>
                    {(!item.config.botToken?.trim() || !item.config.chatId?.trim()) && (
                      <p className="mt-2 text-[11px] text-amber-500">
                        Cần nhập Bot Token và Chat ID trước khi gửi tin test.
                      </p>
                    )}
                  </>
                ) : (
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    Gửi tin test hiện được hỗ trợ cho Telegram. Adapter cho nền tảng này sẽ được bổ sung sau.
                  </p>
                )}
                {testResults[item.id] && (
                  <p className={`mt-2 text-xs ${testResults[item.id].ok ? "text-green-600" : "text-destructive"}`}>
                    {testResults[item.id].ok ? "✓" : "✕"} {testResults[item.id].message}
                  </p>
                )}
              </div>

              {item.type === "messenger" && (
                <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs">
                  <p className="font-semibold text-blue-500">Webhook Messenger</p>
                  <p className="mt-1 break-all font-mono text-blue-400">
                    {webhookBase}/api/webhooks/messenger
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                {item.status === "connected" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void disconnect(item)}
                    disabled={actingId === item.id}
                  >
                    <WifiOff className="mr-1.5 h-3.5 w-3.5" /> Ngắt kết nối
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => void connect(item)}
                    disabled={actingId === item.id}
                  >
                    {actingId === item.id
                      ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      : <Wifi className="mr-1.5 h-3.5 w-3.5" />}
                    Kết nối
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(item)}
                  disabled={actingId === item.id}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" /> Sửa
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => void toggle(item)}
                  disabled={actingId === item.id}
                >
                  {item.isActive
                    ? <><PowerOff className="mr-1.5 h-3.5 w-3.5" /> Tắt</>
                    : <><Power className="mr-1.5 h-3.5 w-3.5" /> Bật</>}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive"
                  onClick={() => void remove(item)}
                  disabled={actingId === item.id}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Xóa
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] w-[calc(100vw-2rem)] max-w-xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Sửa chatbot" : "Tạo chatbot mới"}</DialogTitle>
            <DialogDescription className="sr-only">
              Nhập thông tin kết nối cho chatbot và nền tảng bạn muốn sử dụng.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <Label>Tên chatbot *</Label>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder={`Ví dụ: ${selectedPlatform.label} SmartHomeQ`}
              />
            </div>

            <div className="space-y-2">
              <Label>Chọn nền tảng</Label>
              <Select value={form.type} onValueChange={(value) => selectPlatform(value as PlatformKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((platform) => (
                    <SelectItem key={platform.key} value={platform.key}>
                      {platform.emoji} {platform.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-2xl border bg-muted/20 p-4">
              <div className="mb-3 flex items-start gap-3">
                <span className="text-2xl">{selectedPlatform.emoji}</span>
                <div>
                  <p className="font-semibold">{selectedPlatform.label}</p>
                  <p className="text-xs text-muted-foreground">{selectedPlatform.description}</p>
                </div>
              </div>
              <div className="space-y-3">
                {selectedPlatform.fields.map((field) => (
                  <div key={field.key} className="space-y-1.5">
                    <Label className="text-sm">{field.label}</Label>
                    <Input
                      type="password"
                      value={form.config[field.key] ?? ""}
                      onChange={(event) => setForm((current) => ({
                        ...current,
                        config: { ...current.config, [field.key]: event.target.value },
                      }))}
                      placeholder={field.placeholder}
                      className="font-mono text-xs"
                    />
                    {field.help && <p className="text-[11px] text-muted-foreground">{field.help}</p>}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-xl border bg-primary/5 p-3 text-xs text-muted-foreground">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>
                Thông tin kết nối được lưu cho bot này. Sau khi tạo, bạn có thể kết nối,
                tắt/bật hoặc chỉnh sửa lại cấu hình.
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Hủy</Button>
            <Button onClick={() => void save()} disabled={!form.name.trim() || saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Lưu thay đổi" : "Tạo chatbot"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}