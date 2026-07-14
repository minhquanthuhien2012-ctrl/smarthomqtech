import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fetch as expoFetch } from "expo/fetch";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${baseUrl}/api/anthropic/conversations/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
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
      } catch {}
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

    const assistantMsgId = `a_${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: "assistant", content: "", streaming: true },
    ]);
    setStreaming(true);

    try {
      const res = await expoFetch(
        `${baseUrl}/api/anthropic/conversations/${id}/messages`,
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
          if (!raw || raw === "[DONE]") continue;
          try {
            const evt = JSON.parse(raw);
            if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
              fullText += evt.delta.text;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantMsgId ? { ...m, content: fullText } : m)
              );
            } else if (evt.type === "delta" && evt.text) {
              fullText += evt.text;
              setMessages((prev) =>
                prev.map((m) => m.id === assistantMsgId ? { ...m, content: fullText } : m)
              );
            }
          } catch {}
        }
      }
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsgId ? { ...m, streaming: false, content: fullText || m.content } : m)
      );
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, streaming: false, content: "Có lỗi xảy ra. Vui lòng thử lại." }
            : m
        )
      );
    } finally {
      setStreaming(false);
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 12), borderBottomColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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
          <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
            <TextInput
              style={[styles.textInput, { color: colors.foreground }]}
              placeholder="Nhắn tin..."
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
  msgRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, gap: 8 },
  msgRowUser: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  bubbleText: { fontSize: 15, lineHeight: 22 },
  typingRow: { flexDirection: "row", gap: 5, paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, opacity: 0.7 },
  inputBar: {
    flexDirection: "row", alignItems: "flex-end",
    paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1,
  },
  inputWrap: {
    flex: 1, flexDirection: "row", alignItems: "flex-end",
    borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8, gap: 8,
  },
  textInput: { flex: 1, fontSize: 15, maxHeight: 120, paddingVertical: 2 },
  sendBtn: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
  },
});
