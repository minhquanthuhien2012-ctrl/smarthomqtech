import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

interface SettingRow {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  danger?: boolean;
  toggle?: boolean;
  toggled?: boolean;
  onToggle?: (v: boolean) => void;
}

function Row({ item, colors }: { item: SettingRow; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  return (
    <TouchableOpacity
      style={[styles.row, { borderBottomColor: colors.border }]}
      onPress={item.onPress}
      disabled={!item.onPress && !item.toggle}
      activeOpacity={item.onPress ? 0.7 : 1}
    >
      <View style={[styles.rowIcon, { backgroundColor: item.danger ? colors.destructive + "15" : colors.secondary }]}>
        <Feather name={item.icon as never} size={17} color={item.danger ? colors.destructive : colors.primary} />
      </View>
      <Text style={[styles.rowLabel, { color: item.danger ? colors.destructive : colors.foreground }]}>
        {item.label}
      </Text>
      <View style={styles.rowRight}>
        {item.value ? (
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{item.value}</Text>
        ) : null}
        {item.toggle ? (
          <Switch
            value={item.toggled}
            onValueChange={item.onToggle}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor="#fff"
          />
        ) : item.onPress ? (
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const colorScheme = useColorScheme();
  const [notif, setNotif] = useState(true);

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

  const accountRows: SettingRow[] = [
    {
      icon: "user",
      label: user?.displayName || "Người dùng",
      value: user?.email,
    },
    {
      icon: "shield",
      label: "Bảo mật",
      onPress: () => {},
    },
  ];

  const prefRows: SettingRow[] = [
    {
      icon: "bell",
      label: "Thông báo",
      toggle: true,
      toggled: notif,
      onToggle: setNotif,
    },
    {
      icon: "moon",
      label: "Giao diện",
      value: colorScheme === "dark" ? "Tối" : "Sáng",
    },
  ];

  const appRows: SettingRow[] = [
    {
      icon: "cpu",
      label: "AI Model",
      value: "Claude Sonnet",
    },
    {
      icon: "link",
      label: "Kết nối (Zalo, Xiaozhi...)",
      onPress: () => {},
    },
    {
      icon: "info",
      label: "Phiên bản",
      value: "1.0.0",
    },
  ];

  const dangerRows: SettingRow[] = [
    {
      icon: "log-out",
      label: "Đăng xuất",
      onPress: handleLogout,
      danger: true,
    },
  ];

  const Section = ({ title, rows }: { title: string; rows: SettingRow[] }) => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{title}</Text>
      <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {rows.map((r, i) => (
          <Row key={i} item={r} colors={colors} />
        ))}
      </View>
    </View>
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
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 20) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={styles.avatarText}>
              {(user?.displayName || "U")[0].toUpperCase()}
            </Text>
          </View>
          <View>
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

        <Section title="TÀI KHOẢN" rows={accountRows} />
        <Section title="TUỲ CHỌN" rows={prefRows} />
        <Section title="ỨNG DỤNG" rows={appRows} />
        <Section title="KHÁC" rows={dangerRows} />
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
  content: { padding: 16, gap: 4 },
  profileCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 8,
  },
  avatar: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  profileName: { fontSize: 16, fontWeight: "700" },
  profileEmail: { fontSize: 13, marginTop: 2 },
  badge: { marginLeft: "auto", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontWeight: "600" },
  section: { marginBottom: 8 },
  sectionTitle: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginLeft: 4, letterSpacing: 0.5 },
  sectionCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 14, paddingVertical: 13, borderBottomWidth: 0.5,
  },
  rowIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  rowLabel: { flex: 1, fontSize: 15 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowValue: { fontSize: 14 },
});
