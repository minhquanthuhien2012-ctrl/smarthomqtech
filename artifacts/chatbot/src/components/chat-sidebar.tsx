import { useState } from "react";
import { format } from "date-fns";
import { Plus, MessageSquare, Trash2, Loader2, Menu, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useListAnthropicConversations, useCreateAnthropicConversation, useDeleteAnthropicConversation, getListAnthropicConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";

interface ChatSidebarProps {
  currentId: number | null;
  onSelect: (id: number) => void;
}

export function ChatSidebar({ currentId, onSelect }: ChatSidebarProps) {
  const { data: conversations, isLoading } = useListAnthropicConversations();
  const createConversation = useCreateAnthropicConversation();
  const deleteConversation = useDeleteAnthropicConversation();
  const queryClient = useQueryClient();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleCreate = () => {
    createConversation.mutate(
      { data: { title: "Hội thoại mới" } },
      {
        onSuccess: (data) => {
          queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
          onSelect(data.id);
          setIsMobileOpen(false);
        },
      }
    );
  };

  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm("Bạn có chắc chắn muốn xóa cuộc hội thoại này?")) {
      deleteConversation.mutate(
        { id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
            if (currentId === id) {
              onSelect(0);
            }
          },
        }
      );
    }
  };

  const Content = () => (
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground">
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">SmartHomeQ AI</span>
          <Link href="/admin">
            <button className="text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors p-1 rounded" title="Quản lý Admin">
              <Settings className="h-4 w-4" />
            </button>
          </Link>
        </div>
        <Button
          onClick={handleCreate}
          className="w-full justify-start gap-2 bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90"
          size="lg"
        >
          <Plus className="h-5 w-5" />
          Cuộc hội thoại mới
        </Button>
      </div>

      <ScrollArea className="flex-1 px-3">
        <div className="space-y-1 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : conversations?.length === 0 ? (
            <div className="text-center py-8 text-sm text-sidebar-foreground/50">
              Chưa có hội thoại nào
            </div>
          ) : (
            conversations?.map((conv) => (
              <div
                key={conv.id}
                role="button"
                tabIndex={0}
                onClick={() => {
                  onSelect(conv.id);
                  setIsMobileOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    onSelect(conv.id);
                    setIsMobileOpen(false);
                  }
                }}
                className={`w-full flex flex-col items-start gap-1 p-3 rounded-lg text-left transition-colors group cursor-pointer ${
                  currentId === conv.id
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "hover:bg-sidebar-accent/50 text-sidebar-foreground/80"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 font-medium truncate flex-1 min-w-0">
                    <MessageSquare className="h-4 w-4 shrink-0" />
                    <span className="truncate">{conv.title}</span>
                  </div>
                  <span
                    role="button"
                    tabIndex={0}
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 rounded hover:bg-destructive/10 hover:text-destructive transition-opacity flex items-center justify-center"
                    onClick={(e) => handleDelete(e, conv.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleDelete(e as unknown as React.MouseEvent, conv.id); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </span>
                </div>
                <span className="text-xs text-sidebar-foreground/50 px-6">
                  {format(new Date(conv.createdAt), "dd/MM/yyyy HH:mm")}
                </span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  return (
    <>
      <div className="hidden md:flex w-72 h-screen border-r border-sidebar-border shrink-0">
        <Content />
      </div>
      <div className="md:hidden absolute top-4 left-4 z-50">
        <Sheet open={isMobileOpen} onOpenChange={setIsMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm border-border">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-72 border-sidebar-border bg-sidebar">
            <Content />
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
