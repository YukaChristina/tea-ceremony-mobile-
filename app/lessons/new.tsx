import { useCallback, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { apiFetch } from "@/lib/api";
import LessonEditor from "@/components/LessonEditor";
import Paywall from "@/components/Paywall";
import { getPremiumStatus } from "@/services/purchaseService";

const FREE_LESSON_LIMIT = 10;

const EMPTY_TABS = {
  chashitsu: { items: [] },
  teishu: { entries: [] },
  kyaku: { entries: [] },
};

const EMPTY_LESSON = {
  practiced_on: new Date().toISOString().split("T")[0],
  practice_name: "",
};

export default function NewLessonScreen() {
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);

  const checkAccess = useCallback(() => {
    setLoading(true);
    Promise.all([
      apiFetch("/lessons").then((r) => r.json()),
      getPremiumStatus(),
    ])
      .then(([lessons, isPremium]) => {
        const count = Array.isArray(lessons) ? lessons.length : 0;
        setLocked(!isPremium && count >= FREE_LESSON_LIMIT);
      })
      .finally(() => setLoading(false));
  }, []);

  useFocusEffect(checkAccess);

  const handleSave = async (payload: { practiced_on: string; practice_name: string }) => {
    const res = await apiFetch("/lessons", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`稽古の作成に失敗しました: ${res.status}`);
    return res.json();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4a7c59" />
      </View>
    );
  }

  if (locked) {
    return <Paywall onUnlock={() => setLocked(false)} />;
  }

  return (
    <LessonEditor
      mode="new"
      lesson={EMPTY_LESSON}
      tabs={EMPTY_TABS}
      onSave={handleSave}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f7f3ea",
  },
});
