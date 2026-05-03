import { useState } from "react";
import { ChatArea } from "@/components/chat-area";
import { useListAnthropicConversations, useCreateAnthropicConversation, useDeleteAnthropicConversation, getListAnthropicConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, MessageSquare, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChatPage() {
  const [currentId, setCurrentId] = useState<number | null>(null);
  // Mobile: null = show list, number = show chat
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");

  const { data: conversations, isLoading } = useListAnthropicConversations();
  const createConversation = useCreateAnthropicConversation();
  const deleteConversation = useDeleteAnthropicConversation();
  const queryClient = useQueryClient();

  const selectConv = (id: number) => {
    setCurrentId(id);
    setMobileView("chat");
  };

  const handleCreate = () => {
    createConversation.mutate(
      { data: { title: "Hội thoại mới" } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
          selectConv(data.id);
        },
      }
    );
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm("Xóa hội thoại này?")) {
      deleteConversation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
          if (currentId === id) {
            setCurrentId(null);
            setMobileView("list");
          }
        },
      });
    }
  };

  /* Conversation list panel */
  const ConvList = ({ onSelect }: { onSelect: (id: number) => void }) => (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b shrink-0">
        <Button onClick={handleCreate} size="sm" className="w-full gap-2">
          <Plus className="h-4 w-4" /> Hội thoại mới
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!isLoading && conversations?.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có hội thoại nào</p>
          )}
          {conversations?.map(conv => (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => onSelect(conv.id)}
              onKeyDown={e => { if (e.key === "Enter") onSelect(conv.id); }}
              className={`group flex items-center gap-2 px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                currentId === conv.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted active:bg-muted"
              }`}
            >
              <MessageSquare className="h-4 w-4 shrink-0 opacity-60" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate leading-tight">{conv.title}</p>
                <p className={`text-xs mt-0.5 ${currentId === conv.id ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {format(new Date(conv.createdAt), "dd/MM HH:mm")}
                </p>
              </div>
              <span
                role="button"
                tabIndex={0}
                onClick={e => handleDelete(e, conv.id)}
                onKeyDown={e => { if (e.key === "Enter") handleDelete(e as unknown as React.MouseEvent, conv.id); }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded hover:bg-destructive/20 hover:text-destructive transition-all shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <>
      {/* ── DESKTOP: side by side ── */}
      <div className="hidden md:flex h-full overflow-hidden">
        <aside className="w-64 shrink-0 border-r flex flex-col bg-muted/10">
          <ConvList onSelect={id => setCurrentId(id)} />
        </aside>
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <ChatArea conversationId={currentId} onConversationCreated={id => setCurrentId(id)} />
        </div>
      </div>

      {/* ── MOBILE: toggle between list and chat ── */}
      <div className="md:hidden flex flex-col h-full overflow-hidden">
        {mobileView === "list" ? (
          <ConvList onSelect={selectConv} />
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Back button bar */}
            <div className="flex items-center gap-2 px-3 py-2 border-b shrink-0 bg-background">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 px-2"
                onClick={() => setMobileView("list")}
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="text-sm">Danh sách</span>
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <ChatArea conversationId={currentId} onConversationCreated={selectConv} />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
