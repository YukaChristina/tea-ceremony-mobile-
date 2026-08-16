import { useEffect, useState } from "react";
import { View, ActivityIndicator, Text, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { apiFetch } from "@/lib/api";
import LessonEditor from "@/components/LessonEditor";
import { FONT_SERIF } from "@/lib/fonts";

type LessonDetail = {
  lesson: { id: number; practiced_on: string; practice_name: string };
  tabs: {
    chashitsu: { items: any[] };
    teishu: { entries: any[] };
    kyaku: { entries: any[] };
  };
  photos: Array<{ id: number; url: string }>;
};

export default function EditLessonScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [detail, setDetail] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/lessons/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`取得失敗: ${r.status}`);
        return r.json();
      })
      .then(setDetail)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async (payload: { practiced_on: string; practice_name: string }) => {
    const res = await apiFetch(`/lessons/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`更新に失敗しました: ${res.status}`);
    return res.json();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4a7c59" />
      </View>
    );
  }

  if (error || !detail) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error ?? "稽古が見つかりません"}</Text>
      </View>
    );
  }

  return (
    <LessonEditor
      mode="edit"
      lesson={detail.lesson}
      tabs={detail.tabs}
      initialPhotos={detail.photos ?? []}
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
  errorText: {
    color: "#8a7560",
    fontSize: 14,
    fontFamily: FONT_SERIF,
  },
});
