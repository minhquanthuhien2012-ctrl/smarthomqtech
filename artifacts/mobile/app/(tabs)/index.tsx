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

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, baseUrl, user } = useAuth();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [loadingInit, setLoadingInit] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const resetChat = useCallback(() => {
    setMessages([]);
    setConversation(null);
    setInput("");
    setStreaming(false);
  }, []);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setInput("");
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = {
      id: `u_${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMsg]);

    let convId = conversation?.id;

    if (!convId) {
      setLoadingInit(true);
      try {
        const res = await fetch(`${baseUrl}/api/anthropic/conversations`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ title: content.slice(0, 50) }),
        });
        const data = await res.json();
        convId = data.id;
        setConversation({ id: data.id, title: data.title });
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `e_${Date.now()}`, role: "assistant", content: "Không thể tạo cuộc trò chuyện. Vui lòng thử lại." },
        ]);
        setLoadingInit(false);
        return;
      }
      setLoadingInit(false);
    }

    const assistantMsgId = `a_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await expoFetch(
        `${baseUrl}/api/anthropic/conversations/${convId}/messages`,
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
          if (!raw || raw === "[DONE]") continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              fullText += evt.delta.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: fullText } : m
                )
              );
            } else if (evt.type === "delta" && evt.text) {
              fullText += evt.text;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsgId ? { ...m, content: fullText } : m
                )
              );
            }
          } catch {}
        }
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId ? { ...m, streaming: false, content: fullText || m.content } : m
        )
      );
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, streaming: false, content: "Có lỗi xảy ra. Vui lòng thử lại." }
              : m
          )
        );
      }
    } finally {
      setStreaming(false);
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
              ? { backgroundColor: colors.primary, maxWidth: "80%" }
              : { backgroundColor: colors.bubble, maxWidth: "85%", borderWidth: 1, borderColor: colors.border },
          ]}
        >
          {item.streaming && !item.content ? (
            <View style={styles.typingRow}>
              <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
              <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
              <View style={[styles.dot, { backgroundColor: colors.mutedForeground }]} />
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 0 : 0), borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <View style={styles.headerLeft}>
          <View style={[styles.headerIcon, { backgroundColor: colors.primary + "20" }]}>
            <Feather name="cpu" size={16} color={colors.primary} />
          </View>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>SmartHomeQ AI</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {conversation ? conversation.title.slice(0, 30) : "Cuộc trò chuyện mới"}
            </Text>
          </View>
        </View>
        {!isEmpty && (
          <TouchableOpacity onPress={resetChat} style={styles.newBtn}>
            <Feather name="plus" size={20} color={colors.primary} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        {isEmpty ? (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.primary + "15", borderColor: colors.primary + "30" }]}>
              <Feather name="message-circle" size={40} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Xin chào{user ? `, ${user.displayName}` : ""}!</Text>
            <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
              Tôi là AI tư vấn của SmartHomeQ.{"\n"}Hỏi tôi về sản phẩm nhà thông minh!
            </Text>
            <View style={styles.suggestions}>
              {["Tư vấn camera an ninh", "Đèn thông minh giá rẻ", "Ổ cắm thông minh nào tốt?"].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestion, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                  onPress={() => { setInput(s); }}
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
            contentContainerStyle={[
              styles.list,
              { paddingBottom: 8 + (Platform.OS === "web" ? 34 : 0) },
            ]}
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
              paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8),
            },
          ]}
        >
          {loadingInit && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          )}
          <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Nhắn tin cho AI..."
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
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 15, fontWeight: "700" },
  headerSub: { fontSize: 12, marginTop: 1 },
  newBtn: { padding: 8 },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  emptyIcon: {
    width: 88, height: 88, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1, marginBottom: 20,
  },
  emptyTitle: { fontSize: 22, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 28 },
  suggestions: { gap: 8, width: "100%" },
  suggestion: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, borderWidth: 1, alignItems: "center",
  },
  suggestionText: { fontSize: 14, fontWeight: "500" },
  list: { paddingHorizontal: 12, paddingTop: 12 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingRow: { flexDirection: "row", gap: 5, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingTop: 8,
    borderTopWidth: 1,
  },
  inputWrap: {
    flex: 1, flexDirection: "row", alignItems: "flex-end",
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  textInput: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 2 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
});
