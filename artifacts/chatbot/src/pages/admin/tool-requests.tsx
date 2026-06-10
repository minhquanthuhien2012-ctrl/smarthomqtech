import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Clock, Wrench, Zap, RefreshCw } from "lucide-react";
import { apiBase } from "@/lib/api";

interface ToolRequest {
  id: number;
  userIdentifier: string;
  toolName: string;
  requestType: "tool" | "skill";
  status: "pending" | "approved" | "rejected";
  note: string;
  createdAt: string;
}

export default function ToolRequestsPage() {
  const [requests, setRequests] = useState<ToolRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${apiBase()}/admin/tool-requests`);
      setRequests(await res.json());
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: number, status: "approved" | "rejected") {
    setActingId(id);
    try {
      await fetch(`${apiBase()}/admin/tool-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch {}
    setActingId(null);
  }

  const pending = requests.filter(r => r.status === "pending");
  const done = requests.filter(r => r.status !== "pending");

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Yêu cầu Tool & Skill</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Duyệt hoặc từ chối yêu cầu sử dụng tool/skill từ người dùng</p>
        </div>
        <button onClick={load} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-4 w-4" />
          Tải lại
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Đang tải...</div>
      ) : (
        <>
          {pending.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-amber-600 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Đang chờ duyệt ({pending.length})
              </h2>
              {pending.map(r => (
                <RequestCard key={r.id} request={r} actingId={actingId} onUpdate={updateStatus} />
              ))}
            </div>
          )}

          {done.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">Đã xử lý ({done.length})</h2>
              {done.map(r => (
                <RequestCard key={r.id} request={r} actingId={actingId} onUpdate={updateStatus} />
              ))}
            </div>
          )}

          {requests.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm border rounded-lg">
              Chưa có yêu cầu nào
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RequestCard({ request: r, actingId, onUpdate }: {
  request: ToolRequest;
  actingId: number | null;
  onUpdate: (id: number, status: "approved" | "rejected") => void;
}) {
  return (
    <div className={`rounded-lg border p-4 ${r.status === "pending" ? "border-amber-200 bg-amber-50" : "bg-muted/30"}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 rounded-md p-1.5 ${r.requestType === "tool" ? "bg-blue-100" : "bg-purple-100"}`}>
          {r.requestType === "tool"
            ? <Wrench className="h-4 w-4 text-blue-600" />
            : <Zap className="h-4 w-4 text-purple-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{r.toolName}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              r.requestType === "tool" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
            }`}>{r.requestType}</span>
            <StatusBadge status={r.status} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Người dùng: <span className="font-mono">{r.userIdentifier}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(r.createdAt).toLocaleString("vi-VN")}
          </p>
          {r.note && <p className="text-xs mt-1 text-foreground">{r.note}</p>}
        </div>

        {r.status === "pending" && (
          <div className="flex gap-2 shrink-0">
            <button
              onClick={() => onUpdate(r.id, "approved")}
              disabled={actingId === r.id}
              className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1.5 text-xs text-white font-medium hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Duyệt
            </button>
            <button
              onClick={() => onUpdate(r.id, "rejected")}
              disabled={actingId === r.id}
              className="flex items-center gap-1 rounded-md border border-red-300 px-2.5 py-1.5 text-xs text-red-600 font-medium hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              <XCircle className="h-3.5 w-3.5" />
              Từ chối
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") return <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">Đã duyệt</span>;
  if (status === "rejected") return <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">Từ chối</span>;
  return <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Chờ duyệt</span>;
}
