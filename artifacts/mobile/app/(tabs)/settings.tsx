import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface UserChatbot {
  aiName: string;
  systemPrompt: string;
  model: string;
}

const TAB_BAR_H = Platform.OS === "web" ? 84 : 60;

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout, token, baseUrl } = useAuth();
  const queryClient = useQueryClient();

  const [aiName, setAiName] = useState("AI cá nhân");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: chatbot } = useQuery<UserChatbot>({
    queryKey: ["user-chatbot"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/user/chatbot`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();
      return res.json();
    },
    enabled: !!token,
  });

  useEffect(() => {
    if (chatbot) {
      setAiName(chatbot.aiName || "AI cá nhân");
      setSystemPrompt(chatbot.systemPrompt || "");
    }
  }, [chatbot]);

  const saveChatbot = async () => {
    setSaving(true);
    try {
      await fetch(`${baseUrl}/api/user/chatbot`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ aiName, systemPrompt }),
      });
      queryClient.invalidateQueries({ queryKey: ["user-chatbot"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowAiConfig(false);
    } catch {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Đăng xuất", "Bạn có chắc muốn đăng xuất?", [
      { text: "Huỷ", style: "cancel" },
      {
        text: "Đăng xuất",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {children}
      </View>
    </View>
  );

  const Row = ({
    icon, label, value, onPress, danger, right,
  }: {
    icon: string; label: string; value?: string;
    onPress?: () => void; danger?: boolean;
    right?: React.ReactNode;
  }) => (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: danger ? colors.destructive + "15" : colors.secondary }]}>
        <Feather name={icon as never} size={16} color={danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: danger ? colors.destructive : colors.foreground }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value ? <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{value}</Text> : null}
        {right}
        {onPress && !right ? <Feather name="chevron-right" size={15} color={colors.mutedForeground} /> : null}
      </View>
    </TouchableOpacity>
  );

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
        <Text style={[styles.title, { color: colors.foreground }]}>Cài đặt</Text>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + TAB_BAR_H + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>{(user?.displayName || "U")[0].toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileName, { color: colors.foreground }]}>
              {user?.displayName || "Người dùng"}
            </Text>
            <Text style={[styles.profileEmail, { color: colors.mutedForeground }]}>
              {user?.email}
            </Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.accent + "20" }]}>
            <Text style={[styles.badgeText, { color: colors.accent }]}>
              {user?.role === "admin" ? "Admin" : "User"}
            </Text>
          </View>
        </View>

        {/* AI Config */}
        <Section title="BỘ NÃO AI">
          <Row
            icon="cpu"
            label="Tên AI"
            value={chatbot?.aiName || "AI cá nhân"}
            onPress={() => setShowAiConfig(!showAiConfig)}
          />
          <Row
            icon="layers"
            label="Model"
            value={chatbot?.model?.replace("claude-", "Claude ") || "Claude Sonnet"}
          />
        </Section>

        {showAiConfig && (
          <View style={[styles.aiConfigBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.aiConfigTitle, { color: colors.foreground }]}>Tuỳ chỉnh AI</Text>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>Tên AI</Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, { color: colors.foreground }]}
                value={aiName}
                onChangeText={setAiName}
                placeholder="VD: Trợ lý SmartHomeQ"
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <Text style={[styles.inputLabel, { color: colors.mutedForeground }]}>
              Hướng dẫn thêm cho AI (tuỳ chọn)
            </Text>
            <View style={[styles.inputWrap, { backgroundColor: colors.input, borderColor: colors.border }]}>
              <TextInput
                style={[styles.input, styles.multiInput, { color: colors.foreground }]}
                value={systemPrompt}
                onChangeText={setSystemPrompt}
                placeholder="VD: Luôn trả lời ngắn gọn, ưu tiên sản phẩm Zigbee..."
                placeholderTextColor={colors.mutedForeground}
                multiline
                numberOfLines={4}
              />
            </View>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: colors.primary }, saving && { opacity: 0.6 }]}
              onPress={saveChatbot}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.saveBtnText}>Lưu cài đặt</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        <Section title="TÀI KHOẢN">
          <Row icon="user" label="Hồ sơ" value={user?.displayName} />
          <Row icon="mail" label="Email" value={user?.email} />
        </Section>

        <Section title="KHÁC">
          <Row icon="info" label="Phiên bản" value="1.0.0" />
          <Row
            icon="log-out"
            label="Đăng xuất"
            onPress={handleLogout}
            danger
          />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: "700" },
  content: { padding: 16, gap: 6 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 8,
  },
  avatarCircle: {
    width: 50, height: 50, borderRadius: 15,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  profileName: { fontSize: 16, fontWeight: "700" },
  profileEmail: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  section: { marginBottom: 4 },
  sectionTitle: { fontSize: 11, fontWeight: "700", marginBottom: 6, marginLeft: 4, letterSpacing: 0.8 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 0.5,
  },
  rowIcon: { width: 32, height: 32, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 14, fontWeight: "500" },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 13 },
  aiConfigBox: {
    borderRadius: 14, borderWidth: 1, padding: 16, gap: 10, marginBottom: 8,
  },
  aiConfigTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  inputLabel: { fontSize: 12, fontWeight: "600" },
  inputWrap: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  input: { fontSize: 14 },
  multiInput: { minHeight: 80, textAlignVertical: "top" },
  saveBtn: {
    paddingVertical: 12, borderRadius: 12, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
