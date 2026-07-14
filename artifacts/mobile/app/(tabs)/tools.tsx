import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Tool {
  id: number;
  name: string;
  description: string;
  isBuiltin: boolean;
  isActive: boolean;
}

interface Skill {
  id: number;
  name: string;
  description: string;
  isActive: boolean;
}

interface UserChatbot {
  enabledTools: string[];
  enabledSkills: string[];
}

const TOOL_ICONS: Record<string, string> = {
  fetch_url: "globe",
  calculator: "cpu",
  get_current_time: "clock",
  gdrive_list_files: "folder",
  gdrive_read_file: "file-text",
  gdrive_search: "search",
};

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, baseUrl } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"tools" | "skills">("tools");

  const { data: tools, isLoading: toolsLoading, refetch: refetchTools } = useQuery<Tool[]>({
    queryKey: ["tools"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/admin/tools`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: skills, isLoading: skillsLoading, refetch: refetchSkills } = useQuery<Skill[]>({
    queryKey: ["skills"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/admin/skills`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: chatbot, refetch: refetchChatbot } = useQuery<UserChatbot>({
    queryKey: ["user-chatbot"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/user/chatbot`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { enabledTools: [], enabledSkills: [] };
      return res.json();
    },
    enabled: !!token,
  });

  const updateChatbot = useMutation({
    mutationFn: async (data: Partial<UserChatbot>) => {
      const res = await fetch(`${baseUrl}/api/user/chatbot`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-chatbot"] });
    },
  });

  const enabledTools = chatbot?.enabledTools ?? [];
  const enabledSkills = chatbot?.enabledSkills ?? [];

  const toggleTool = (name: string, enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newEnabled = enabled
      ? [...enabledTools, name]
      : enabledTools.filter((t) => t !== name);
    updateChatbot.mutate({ enabledTools: newEnabled });
  };

  const toggleSkill = (name: string, enabled: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newEnabled = enabled
      ? [...enabledSkills, name]
      : enabledSkills.filter((s) => s !== name);
    updateChatbot.mutate({ enabledSkills: newEnabled });
  };

  const isLoading = toolsLoading || skillsLoading;

  const TAB_BAR_HEIGHT = Platform.OS === "web" ? 84 : 60;

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
        <Text style={[styles.title, { color: colors.foreground }]}>Tools & Skills</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Quản lý công cụ AI của bạn
        </Text>

        <View style={[styles.tabRow, { backgroundColor: colors.muted }]}>
          {(["tools", "skills"] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tabBtn, tab === t && { backgroundColor: colors.primary }]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, { color: tab === t ? "#fff" : colors.mutedForeground }]}>
                {t === "tools" ? "🔧 Tools" : "⚡ Skills"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 16 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={isLoading}
              onRefresh={() => { refetchTools(); refetchSkills(); refetchChatbot(); }}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {tab === "tools" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {(tools ?? []).length} tools có sẵn — bật để AI sử dụng
              </Text>
              {(tools ?? []).filter((t) => t.isActive).map((tool) => (
                <View
                  key={tool.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.cardIcon, { backgroundColor: colors.primary + "15" }]}>
                    <Feather
                      name={(TOOL_ICONS[tool.name] || "tool") as never}
                      size={18}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{tool.name}</Text>
                    <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {tool.description || "Không có mô tả"}
                    </Text>
                    {tool.isBuiltin && (
                      <View style={[styles.badge, { backgroundColor: colors.accent + "20" }]}>
                        <Text style={[styles.badgeText, { color: colors.accent }]}>Builtin</Text>
                      </View>
                    )}
                  </View>
                  <Switch
                    value={enabledTools.includes(tool.name)}
                    onValueChange={(v) => toggleTool(tool.name, v)}
                    trackColor={{ false: colors.border, true: colors.primary }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
              {(tools ?? []).filter((t) => t.isActive).length === 0 && (
                <View style={styles.emptyState}>
                  <Feather name="tool" size={36} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Chưa có tool nào</Text>
                </View>
              )}
            </>
          )}

          {tab === "skills" && (
            <>
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
                {(skills ?? []).length} skills — automation tự động
              </Text>
              {(skills ?? []).filter((s) => s.isActive).map((skill) => (
                <View
                  key={skill.id}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                  <View style={[styles.cardIcon, { backgroundColor: colors.accent + "15" }]}>
                    <Feather name="zap" size={18} color={colors.accent} />
                  </View>
                  <View style={styles.cardContent}>
                    <Text style={[styles.cardTitle, { color: colors.foreground }]}>{skill.name}</Text>
                    <Text style={[styles.cardDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                      {skill.description || "Skill tự động hoá"}
                    </Text>
                  </View>
                  <Switch
                    value={enabledSkills.includes(skill.name)}
                    onValueChange={(v) => toggleSkill(skill.name, v)}
                    trackColor={{ false: colors.border, true: colors.accent }}
                    thumbColor="#fff"
                  />
                </View>
              ))}
              {(skills ?? []).filter((s) => s.isActive).length === 0 && (
                <View style={styles.emptyState}>
                  <Feather name="zap" size={36} color={colors.mutedForeground} />
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Chưa có skill nào</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 0,
    borderBottomWidth: 1,
  },
  title: { fontSize: 22, fontWeight: "700", marginBottom: 2 },
  subtitle: { fontSize: 13, marginBottom: 12 },
  tabRow: { flexDirection: "row", borderRadius: 10, padding: 3, marginBottom: 12 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  tabText: { fontSize: 14, fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  sectionLabel: { fontSize: 12, marginBottom: 4 },
  card: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  cardIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "600", marginBottom: 3 },
  cardDesc: { fontSize: 12, lineHeight: 17 },
  badge: { marginTop: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "600" },
  emptyState: { alignItems: "center", gap: 8, paddingVertical: 32 },
  emptyText: { fontSize: 15 },
});
