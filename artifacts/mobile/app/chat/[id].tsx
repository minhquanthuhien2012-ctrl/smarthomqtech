import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch as expoFetch } from "expo/fetch";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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

interface ToolCallStatus {
  name: string;
  status: "starting" | "running" | "done" | "error";
}

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, baseUrl } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("Cuộc trò chuyện");
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [activeTools, setActiveTools] = useState<ToolCallStatus[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/user/chat/conversations/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error();
        const data = await res.json();
        setTitle(data.title || "Cuộc trò chuyện");
        const msgs: Message[] = (data.messages || []).map(
          (m: { id: number; role: string; content: string }) => ({
            id: String(m.id),
            role: m.role as "user" | "assistant",
            content: m.content,
          })
        );
        setMessages(msgs);
      } catch {
        router.back();
      }
      setLoading(false);
    })();
  }, [id, baseUrl, token]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: `u_${Date.now()}`, role: "user", content };
    setMessages((prev) => [...prev, userMsg]);

    const aId = `a_${Date.now()}`;
    setMessages((prev) => [...prev, { id: aId, role: "assistant", content: "", streaming: true }]);
    setStreaming(true);
    setActiveTools([]);

    try {
      const res = await expoFetch(
        `${baseUrl}/api/user/chat/conversations/${id}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            Accept: "text/event-stream",
          },
          body: JSON.stringify({ content }),
          // @ts-ignore
          reactNative: { textStreaming: true },
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
            }
          } catch {}
        }
      }
      setMessages((prev) =>
        prev.map((m) => m.id === aId ? { ...m, streaming: false, content: fullText || m.content } : m)
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aId ? { ...m, streaming: false, content: "Có lỗi xảy ra. Vui lòng thử lại." } : m
        )
      );
    } finally {
      setStreaming(false);
      setActiveTools([]);
    }
  }, [input, streaming, id, baseUrl, token]);

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

  const activeTool = activeTools.find((t) => t.status === "running" || t.status === "starting");

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={0}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} size="large" />
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
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Tiếp tục hỏi..."
              placeholderTextColor={colors.mutedForeground}
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              style={[styles.sendBtn, { backgroundColor: input.trim() && !streaming ? colors.primary : colors.muted }]}
              onPress={sendMessage}
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
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1,
  },
  backBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: "700", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { paddingHorizontal: 12, paddingTop: 12 },
  toolBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginBottom: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  toolText: { fontSize: 13, fontWeight: "500" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 10, gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingRow: { flexDirection: "row", gap: 5, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  inputBar: { paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  inputWrap: {
    flexDirection: "row", alignItems: "flex-end",
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  textInput: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 2 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
});
