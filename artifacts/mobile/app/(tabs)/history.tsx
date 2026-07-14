import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

const TAB_BAR_H = Platform.OS === "web" ? 84 : 60;

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "Vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} ngày trước`;
  return new Date(dateStr).toLocaleDateString("vi-VN");
}

export default function HistoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, baseUrl } = useAuth();
  const queryClient = useQueryClient();

  const { data, isLoading, refetch } = useQuery<Conversation[]>({
    queryKey: ["user-conversations"],
    queryFn: async () => {
      const res = await fetch(`${baseUrl}/api/user/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Lỗi tải lịch sử");
      return res.json();
    },
    enabled: !!token,
  });

  const deleteConv = useCallback(
    async (id: number, title: string) => {
      Alert.alert(
        "Xoá hội thoại",
        `Xoá "${title.slice(0, 40)}"?`,
        [
          { text: "Huỷ", style: "cancel" },
          {
            text: "Xoá",
            style: "destructive",
            onPress: async () => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              await fetch(`${baseUrl}/api/user/chat/conversations/${id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              queryClient.invalidateQueries({ queryKey: ["user-conversations"] });
            },
          },
        ]
      );
    },
    [baseUrl, token, queryClient]
  );

  const renderItem = ({ item, index }: { item: Conversation; index: number }) => (
    <TouchableOpacity
      style={[
        styles.item,
        { backgroundColor: colors.card, borderColor: colors.border },
        index === 0 && { marginTop: 0 },
      ]}
      onPress={() => router.push(`/chat/${item.id}` as never)}
      activeOpacity={0.75}
    >
      <View style={[styles.itemIcon, { backgroundColor: colors.primary + "15" }]}>
        <Feather name="message-circle" size={18} color={colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <Text style={[styles.itemTitle, { color: colors.foreground }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[styles.itemTime, { color: colors.mutedForeground }]}>
          {timeAgo(item.createdAt)}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => deleteConv(item.id, item.title)}
        style={styles.deleteBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="trash-2" size={15} color={colors.mutedForeground} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const conversations = data ?? [];

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
        <Text style={[styles.title, { color: colors.foreground }]}>Lịch sử</Text>
        {conversations.length > 0 && (
          <Text style={[styles.count, { color: colors.mutedForeground }]}>
            {conversations.length} hội thoại
          </Text>
        )}
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : conversations.length === 0 ? (
        <View style={[styles.center, { paddingBottom: TAB_BAR_H }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
            <Feather name="clock" size={32} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Chưa có hội thoại</Text>
          <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
            Bắt đầu chat từ tab Chat
          </Text>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.list,
            { paddingBottom: insets.bottom + TAB_BAR_H + 8 },
          ]}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.primary} />
          }
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20, paddingBottom: 14,
    borderBottomWidth: 1,
    flexDirection: "row", alignItems: "baseline", gap: 8,
  },
  title: { fontSize: 22, fontWeight: "700" },
  count: { fontSize: 13 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  emptyIcon: { width: 64, height: 64, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 17, fontWeight: "600" },
  emptySubtitle: { fontSize: 14 },
  list: { paddingHorizontal: 16, paddingTop: 12 },
  item: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  itemIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "600", marginBottom: 3 },
  itemTime: { fontSize: 12 },
  deleteBtn: { padding: 4 },
});
