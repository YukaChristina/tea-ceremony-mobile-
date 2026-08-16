import { Tabs } from "expo-router";
import { Text } from "react-native";
import { FONT_SERIF } from "@/lib/fonts";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#4a7c59",
        tabBarInactiveTintColor: "#8a7560",
        tabBarStyle: {
          backgroundColor: "#fdfaf3",
          borderTopColor: "#d6c9b0",
        },
        tabBarLabelStyle: { fontFamily: FONT_SERIF },
        headerStyle: { backgroundColor: "#f7f3ea" },
        headerTintColor: "#2c2416",
        headerTitleStyle: { letterSpacing: 2, fontWeight: "600", fontFamily: FONT_SERIF },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ホーム",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="diary"
        options={{
          title: "稽古日誌",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>✏️</Text>,
        }}
      />
      <Tabs.Screen
        name="lessons"
        options={{
          title: "振り返り",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📓</Text>,
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: "アルバム",
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>📷</Text>,
        }}
      />
    </Tabs>
  );
}
