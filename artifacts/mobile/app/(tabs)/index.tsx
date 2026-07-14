import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch as expoFetch } from "expo/fetch";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface Conversation {
  id: number;
  title: string;
}

interface ToolCallStatus {
  name: string;
  status: "starting" | "running" | "done" | "error";
}

const TAB_BAR_H = Platform.OS === "web" ? 84 : 60;

const SUGGESTIONS = [
  "Tư vấn camera an ninh trong nhà",
  "Đèn thông minh Zigbee giá tốt",
  "Ổ cắm WiFi nào tiết kiệm điện?",
  "So sánh Zigbee và WiFi cho nhà thông minh",
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, baseUrl, user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loadingInit, setLoadingInit] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolCallStatus[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const resetChat = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setConversation(null);
    setInput("");
    setStreaming(false);
    setActiveTools([]);
  }, []);

  const sendMessage = useCallback(async (content?: string) => {
    const text = (content ?? input).trim();
    if (!text || streaming) return;
    if (!content) setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);

    let convId = conversation?.id;

    if (!convId) {
      setLoadingInit(true);
      try {
        const res = await fetch(`${baseUrl}/api/user/chat/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: text.slice(0, 60) }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Lỗi tạo hội thoại");
        convId = data.id;
        setConversation({ id: data.id, title: data.title });
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `e_${Date.now()}`, role: "assistant", content: "Không thể kết nối AI. Vui lòng thử lại." },
        ]);
        setLoadingInit(false);
        return;
      }
      setLoadingInit(false);
    }

    const aId = `a_${Date.now()}`;
    setMessages((prev) => [...prev, { id: aId, role: "assistant", content: "", streaming: true }]);
    setStreaming(true);
    setActiveTools([]);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await expoFetch(
        `${baseUrl}/api/user/chat/conversations/${convId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ content: text }),
          // @ts-ignore
          reactNative: { textStreaming: true },
          signal: controller.signal,
        }
      );

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          try {
            const evt = JSON.parse(raw) as {
              content?: string;
              done?: boolean;
              error?: string;
              tool_call?: { name: string; status: string };
            };

            if (evt.content) {
              fullText += evt.content;
              setMessages((prev) =>
                prev.map((m) => m.id === aId ? { ...m, content: fullText } : m)
              );
            } else if (evt.tool_call) {
              const tc = evt.tool_call;
              setActiveTools((prev) => {
                const idx = prev.findIndex((t) => t.name === tc.name);
                if (idx >= 0) {
                  const copy = [...prev];
                  copy[idx] = { name: tc.name, status: tc.status as ToolCallStatus["status"] };
                  return copy;
                }
                return [...prev, { name: tc.name, status: tc.status as ToolCallStatus["status"] }];
              });
            } else if (evt.done) {
              break;
            } else if (evt.error) {
              setMessages((prev) =>
                prev.map((m) => m.id === aId ? { ...m, content: `Lỗi: ${evt.error}`, streaming: false } : m)
              );
            }
          } catch {}
        }
      }
      setMessages((prev) =>
        prev.map((m) => m.id === aId ? { ...m, streaming: false, content: fullText || m.content } : m)
      );
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aId ? { ...m, streaming: false, content: "Có lỗi xảy ra. Vui lòng thử lại." } : m
          )
        );
      }
    } finally {
      setStreaming(false);
      setActiveTools([]);
      abortRef.current = null;
    }
  }, [input, streaming, conversation, baseUrl, token]);

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="cpu" size={14} color={colors.primary} />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: colors.userBubble, maxWidth: "80%" }
              : { backgroundColor: colors.bubble, maxWidth: "85%", borderWidth: 1, borderColor: colors.border },
          ]}
        >
          {item.streaming && !item.content ? (
            <View style={styles.typingRow}>
              {[0, 1, 2].map((i) => (
                <View key={i} style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
              ))}
            </View>
          ) : (
            <Text style={[styles.bubbleText, { color: isUser ? "#fff" : colors.foreground }]}>
              {item.content}
            </Text>
          )}
        </View>
      </View>
    );
  };

  const isEmpty = messages.length === 0;
  const activeTool = activeTools.find((t) => t.status === "running" || t.status === "starting");

  const bottomPad = insets.bottom + TAB_BAR_H;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12),
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="cpu" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>SmartHomeQ AI</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {conversation ? conversation.title.slice(0, 28) + (conversation.title.length > 28 ? "…" : "") : "Hội thoại mới"}
            </Text>
          </View>
        </View>
        {!isEmpty && (
          <TouchableOpacity onPress={resetChat} style={styles.newBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Feather name="plus-circle" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {isEmpty ? (
          <View style={[styles.emptyState, { paddingBottom: bottomPad + 60 }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
              <Feather name="message-circle" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
              Xin chào{user?.displayName ? `, ${user.displayName}` : ""}!
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Tôi là AI tư vấn SmartHomeQ.{"\n"}Hỏi tôi về thiết bị nhà thông minh!
            </Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestion, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => sendMessage(s)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.suggestionText, { color: colors.foreground }]}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            data={[...messages].reverse()}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            inverted
            contentContainerStyle={styles.list}
            ListHeaderComponent={
              activeTool ? (
                <View style={[styles.toolBanner, { backgroundColor: colors.accent + "15", borderColor: colors.accent + "30" }]}>
                  <ActivityIndicator size="small" color={colors.accent} />
                  <Text style={[styles.toolText, { color: colors.accent }]}>
                    Đang dùng: {activeTool.name}
                  </Text>
                </View>
              ) : null
            }
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: bottomPad,
            },
          ]}
        >
          {loadingInit && <ActivityIndicator size="small" color={colors.primary} style={styles.initSpinner} />}
          <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Hỏi về sản phẩm nhà thông minh..."
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              returnKeyType="default"
            />
            <TouchableOpacity
              style={[
                styles.sendBtn,
                { backgroundColor: input.trim() && !streaming ? colors.primary : colors.muted },
              ]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || streaming}
              activeOpacity={0.8}
            >
              {streaming ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Feather name="send" size={16} color={input.trim() ? "#fff" : colors.mutedForeground} />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  newBtn: { padding: 4 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 },
  emptyIcon: {
    width: 84, height: 84, borderRadius: 24,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  suggestions: { gap: 8, width: "100%" },
  suggestion: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1,
  },
  suggestionText: { fontSize: 14, fontWeight: "500" },
  list: { paddingHorizontal: 12, paddingTop: 12 },
  toolBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginHorizontal: 12, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  toolText: { fontSize: 13, fontWeight: "500" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 10, gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingRow: { flexDirection: "row", gap: 5, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  inputBar: {
    paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1,
  },
  initSpinner: { marginBottom: 6 },
  inputWrap: {
    flexDirection: "row", alignItems: "flex-end",
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  textInput: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 2 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
});
