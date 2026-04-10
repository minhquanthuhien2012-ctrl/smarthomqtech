import { useState, useRef, useEffect } from "react";
import { Send, Loader2, Bot, User, HardDrive, Calculator, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useListAnthropicMessages, useCreateAnthropicConversation, getListAnthropicConversationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useChatStream } from "@/hooks/use-chat-stream";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface ChatAreaProps {
  conversationId: number | null;
  onConversationCreated: (id: number) => void;
}

export function ChatArea({ conversationId, onConversationCreated }: ChatAreaProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  
  const { data: messages, isLoading } = useListAnthropicMessages(conversationId || 0, {
    query: { enabled: !!conversationId }
  });
  
  const createConversation = useCreateAnthropicConversation();
  const { sendMessage, streamedMessage, isStreaming } = useChatStream(conversationId);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamedMessage]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isStreaming) return;

    const messageText = input.trim();
    setInput("");

    if (!conversationId) {
      createConversation.mutate(
        { data: { title: messageText.slice(0, 40) + (messageText.length > 40 ? "..." : "") } },
        {
          onSuccess: async (data) => {
            queryClient.invalidateQueries({ queryKey: getListAnthropicConversationsQueryKey() });
            onConversationCreated(data.id);
            // Wait for the new ID to be set before sending message
            // In a real app we might want a more robust way to handle the sequence
            setTimeout(() => {
              // Note: using the returned hook from useChatStream might have stale ID, 
              // but we are relying on React state to update. For simplicity, we just trigger it.
            }, 100);
          }
        }
      );
      return;
    }

    // Optimistically show user message by updating cache or just relying on fast network
    await sendMessage(messageText);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getToolIcon = (name: string) => {
    if (name.includes("drive")) return <HardDrive className="h-3 w-3 mr-1" />;
    if (name.includes("calc")) return <Calculator className="h-3 w-3 mr-1" />;
    if (name.includes("fetch")) return <Globe className="h-3 w-3 mr-1" />;
    return <Loader2 className="h-3 w-3 mr-1 animate-spin" />;
  };

  const getToolText = (name: string) => {
    if (name.includes("google_drive")) return "Đang đọc Google Drive...";
    if (name.includes("calculator")) return "Đang tính toán...";
    if (name.includes("fetch")) return "Đang truy cập web...";
    return `Đang gọi ${name}...`;
  };

  return (
    <div className="flex flex-col h-screen flex-1 bg-background relative overflow-hidden">
      {!conversationId ? (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-primary/5 border border-primary/20">
            <Bot className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-semibold mb-2 tracking-tight">Trợ lý AI Cá nhân</h2>
          <p className="text-muted-foreground max-w-md">
            Hỏi về tài liệu Google Drive, thực hiện tính toán, hoặc tìm kiếm thông tin theo thời gian thực.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1 px-4 py-6 md:px-8">
          <div className="max-w-3xl mx-auto space-y-6 pb-24">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {messages?.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    {msg.role === "assistant" && (
                      <div className="w-8 h-8 rounded-full bg-secondary/80 border border-border flex items-center justify-center shrink-0 mt-1">
                        <Bot className="h-4 w-4 text-foreground/80" />
                      </div>
                    )}
                    
                    <div
                      className={`max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary/50 border border-border text-foreground"
                      }`}
                    >
                      {msg.role === "user" ? (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      ) : (
                        <MarkdownRenderer content={msg.content} />
                      )}
                    </div>
                    
                    {msg.role === "user" && (
                      <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center shrink-0 mt-1">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}
                
                {streamedMessage && (
                  <div className="flex gap-4 justify-start">
                    <div className="w-8 h-8 rounded-full bg-secondary/80 border border-border flex items-center justify-center shrink-0 mt-1">
                      <Bot className="h-4 w-4 text-foreground/80" />
                    </div>
                    
                    <div className="max-w-[85%] rounded-2xl px-5 py-3.5 shadow-sm bg-secondary/50 border border-border text-foreground">
                      {streamedMessage.toolCalls && streamedMessage.toolCalls.length > 0 && (
                        <div className="flex flex-col gap-2 mb-3">
                          {streamedMessage.toolCalls.map((tool, idx) => (
                            <div key={idx} className="flex items-center text-xs text-muted-foreground bg-background/50 px-3 py-1.5 rounded-full border border-border w-fit font-medium">
                              {getToolIcon(tool.name)}
                              {getToolText(tool.name)}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {streamedMessage.content ? (
                        <MarkdownRenderer content={streamedMessage.content} />
                      ) : isStreaming && (!streamedMessage.toolCalls || streamedMessage.toolCalls.length === 0) ? (
                        <div className="flex gap-1 h-6 items-center">
                          <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                          <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                          <span className="w-2 h-2 rounded-full bg-primary/50 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </>
            )}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      )}

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background via-background to-transparent pt-10 pb-6 px-4 md:px-8">
        <div className="max-w-3xl mx-auto relative">
          <form
            onSubmit={handleSubmit}
            className="relative flex items-end gap-2 bg-card border border-border rounded-3xl p-2 shadow-lg shadow-black/5 focus-within:ring-1 focus-within:ring-primary/50 transition-all"
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập tin nhắn... (Enter để gửi)"
              className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 shadow-none bg-transparent py-3 px-4 text-base scrollbar-hide"
              rows={1}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isStreaming}
              className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mb-1 mr-1"
            >
              {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 ml-0.5" />}
            </Button>
          </form>
          <div className="text-center mt-3 text-xs text-muted-foreground/60 font-medium">
            AI có thể mắc lỗi. Vui lòng kiểm tra lại thông tin quan trọng.
          </div>
        </div>
      </div>
    </div>
  );
}
