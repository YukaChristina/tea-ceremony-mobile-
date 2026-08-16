import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { FONT_SERIF } from "@/lib/fonts";

export default function HomeScreen() {
  const router = useRouter();

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <View style={styles.container}>
      <View style={styles.decorLine}>
        <View style={styles.line} />
        <Text style={styles.schoolName}>茶道</Text>
        <View style={styles.line} />
      </View>

      <Text style={styles.title}>稽古日誌</Text>
      <Text style={styles.subtitle}>Sado Practice Log</Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push("/lessons/new")}
          activeOpacity={0.7}
        >
          <Text style={styles.primaryButtonText}>稽古を記録する</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push("/(tabs)/lessons")}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>稽古を振り返る</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push("/(tabs)/photos")}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryButtonText}>アルバムを見る</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Text style={styles.logoutButtonText}>ログアウト</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.diamond}>◇</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f3ea",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    gap: 16,
  },
  decorLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  line: {
    width: 40,
    height: 1,
    backgroundColor: "#4a7c59",
  },
  schoolName: {
    fontSize: 12,
    color: "#4a7c59",
    letterSpacing: 4,
    fontFamily: FONT_SERIF,
  },
  title: {
    fontSize: 32,
    fontWeight: "600",
    color: "#2c2416",
    letterSpacing: 4,
    fontFamily: FONT_SERIF,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: "#8a7560",
    letterSpacing: 2,
    marginBottom: 16,
    fontFamily: FONT_SERIF,
  },
  actions: {
    width: "100%",
    maxWidth: 320,
    gap: 14,
  },
  primaryButton: {
    backgroundColor: "#4a7c59",
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: "500",
    fontFamily: FONT_SERIF,
  },
  secondaryButton: {
    backgroundColor: "#fdfaf3",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d6c9b0",
    paddingVertical: 16,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#2c2416",
    fontSize: 16,
    letterSpacing: 2,
    fontFamily: FONT_SERIF,
  },
  logoutButton: {
    paddingVertical: 16,
    alignItems: "center",
  },
  logoutButtonText: {
    color: "#8a7560",
    fontSize: 14,
    letterSpacing: 1,
    fontFamily: FONT_SERIF,
  },
  diamond: {
    fontSize: 20,
    color: "#4a7c59",
    opacity: 0.4,
    marginTop: 8,
  },
});
