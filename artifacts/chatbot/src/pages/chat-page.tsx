import { useState } from "react";
import { ChatArea } from "@/components/chat-area";
import { useListAnthropicConversations, useCreateAnthropicConversation, useDeleteAnthropicConversation, getListAnthropicConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, MessageSquare, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function ChatPage() {
  const [currentId, setCurrentId] = useState<number | null>(null);
  const { data: conversations, isLoading } = useListAnthropicConversations();
  const createConversation = useCreateAnthropicConversation();
  const deleteConversation = useDeleteAnthropicConversation();
  const queryClient = useQueryClient();

  const handleCreate = () => {
    createConversation.mutate(
      { data: { title: "Hội thoại mới" } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
          setCurrentId(data.id);
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
          if (currentId === id) setCurrentId(null);
        },
      });
    }
  };

  return (
    <div className="flex h-full overflow-hidden">
      <aside className="w-64 shrink-0 border-r flex flex-col bg-muted/20">
        <div className="p-3 border-b">
          <Button onClick={handleCreate} size="sm" className="w-full gap-2">
            <Plus className="h-4 w-4" /> Hội thoại mới
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {conversations?.map(conv => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => setCurrentId(conv.id)}
                onKeyDown={e => { if (e.key === "Enter") setCurrentId(conv.id); }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                  currentId === conv.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{conv.title}</p>
                  <p className={`text-xs ${currentId === conv.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {format(new Date(conv.createdAt), "dd/MM HH:mm")}
                  </p>
                </div>
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => handleDelete(e, conv.id)}
                  onKeyDown={e => { if (e.key === "Enter") handleDelete(e as unknown as React.MouseEvent, conv.id); }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/20 hover:text-destructive transition-all"
                >
                  <Trash2 className="h-3 w-3" />
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      </aside>

      <div className="flex-1 min-w-0">
        <ChatArea conversationId={currentId} onConversationCreated={setCurrentId} />
      </div>
    </div>
  );
}
