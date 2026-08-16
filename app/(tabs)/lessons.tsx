import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { FONT_SERIF } from "@/lib/fonts";

type Lesson = {
  id: number;
  practiced_on: string;
  practice_name: string;
  teishu_temae_name?: string;
  kyaku_temae_name?: string;
};

// 保存形式は "茶の種類/棚の状態/稽古名"（例: "薄茶/なし/貴人点て"）。
// 棚が「なし」のときはその区切りを表示から省く。
function formatPracticeName(raw: string): string {
  const parts = raw.split("/");
  if (parts.length < 3) return raw;
  const [teaType, shelfPart, ...rest] = parts;
  const practiceName = rest.join("/");
  if (shelfPart === "なし") return `${teaType} ${practiceName}`;
  return `${teaType} ${shelfPart} ${practiceName}`;
}

export default function LessonsScreen() {
  const router = useRouter();
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [query, setQuery] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [loading, setLoading] = useState(true);
  const [matchIds, setMatchIds] = useState<Set<number> | null>(null);
  const [searching, setSearching] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      apiFetch("/lessons")
        .then((r) => r.json())
        .then((data) => setLessons(Array.isArray(data) ? data : []))
        .catch(console.error)
        .finally(() => setLoading(false));
    }, [])
  );

  useEffect(() => {
    const q = query.trim();
    if (!q) { setMatchIds(null); return; }
    setSearching(true);
    apiFetch(`/search?query=${encodeURIComponent(q)}&limit=200`)
      .then((r) => r.json())
      .then((data) => {
        const results = Array.isArray(data) ? data : (data.results ?? []);
        setMatchIds(new Set<number>(results.map((item: any) => item.lesson_id)));
      })
      .finally(() => setSearching(false));
  }, [query]);

  const sorted = lessons.slice().sort((a, b) => b.practiced_on.localeCompare(a.practiced_on));
  const years = Array.from(new Set(sorted.map((l) => l.practiced_on.slice(0, 4)))).sort((a, b) => b.localeCompare(a));
  const months = ["01","02","03","04","05","06","07","08","09","10","11","12"];

  const filtered = sorted.filter((l) => {
    if (filterYear && l.practiced_on.slice(0, 4) !== filterYear) return false;
    if (filterMonth && l.practiced_on.slice(5, 7) !== filterMonth) return false;
    if (matchIds !== null && !matchIds.has(l.id)) return false;
    return true;
  });

  const handleDelete = (lesson: Lesson) => {
    Alert.alert(
      "稽古を削除しますか?",
      "この操作は取り消せません。記録した内容や写真もすべて削除されます。",
      [
        { text: "キャンセル", style: "cancel" },
        {
          text: "削除する",
          style: "destructive",
          onPress: async () => {
            setDeletingId(lesson.id);
            try {
              const res = await apiFetch(`/lessons/${lesson.id}`, { method: "DELETE" });
              if (!res.ok) throw new Error(`削除に失敗しました: ${res.status}`);
              setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
              Alert.alert("削除しました");
            } catch (e: any) {
              Alert.alert("エラー", e?.message ?? "削除に失敗しました");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {/* フィルター行 */}
      <View style={styles.filterRow}>
        <TouchableOpacity style={styles.picker} onPress={() => setShowYearPicker(true)}>
          <Text style={styles.pickerText}>{filterYear ? `${filterYear}年` : "すべての年"}</Text>
          <Text style={styles.pickerCaret}>▾</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.picker} onPress={() => setShowMonthPicker(true)}>
          <Text style={styles.pickerText}>{filterMonth ? `${parseInt(filterMonth)}月` : "すべての月"}</Text>
          <Text style={styles.pickerCaret}>▾</Text>
        </TouchableOpacity>
      </View>

      {/* 検索 */}
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="キーワードで検索（道具名・銘・メモなど）..."
          placeholderTextColor="#8a7560"
          value={query}
          onChangeText={setQuery}
        />
        {searching && <ActivityIndicator size="small" color="#8a7560" style={styles.searchIndicator} />}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#4a7c59" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ gap: 12, paddingBottom: 20 }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>
              {(query || filterYear || filterMonth) ? "該当する稽古がありません。" : "まだ稽古がありません。"}
            </Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/lessons/${item.id}`)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardDate}>{item.practiced_on}</Text>
              <Text style={styles.cardName}>{formatPracticeName(item.practice_name)}</Text>
              {item.teishu_temae_name && (
                <Text style={styles.cardSub}>亭主: {formatPracticeName(item.teishu_temae_name)}</Text>
              )}
              {item.kyaku_temae_name && (
                <Text style={styles.cardSub}>客: {formatPracticeName(item.kyaku_temae_name)}</Text>
              )}
              <TouchableOpacity
                style={styles.editButton}
                onPress={() => router.push(`/lessons/${item.id}/edit`)}
              >
                <Text style={styles.editButtonText}>編集</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={() => handleDelete(item)}
                disabled={deletingId === item.id}
              >
                {deletingId === item.id ? (
                  <ActivityIndicator size="small" color="#c0392b" />
                ) : (
                  <Text style={styles.deleteButtonText}>削除</Text>
                )}
              </TouchableOpacity>
            </TouchableOpacity>
          )}
        />
      )}

      {/* 年ピッカーモーダル */}
      <Modal visible={showYearPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowYearPicker(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <TouchableOpacity style={styles.modalItem} onPress={() => { setFilterYear(""); setShowYearPicker(false); }}>
                <Text style={[styles.modalItemText, !filterYear && styles.modalItemActive]}>すべての年</Text>
              </TouchableOpacity>
              {years.map((y) => (
                <TouchableOpacity key={y} style={styles.modalItem} onPress={() => { setFilterYear(y); setShowYearPicker(false); }}>
                  <Text style={[styles.modalItemText, filterYear === y && styles.modalItemActive]}>{y}年</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 月ピッカーモーダル */}
      <Modal visible={showMonthPicker} transparent animationType="fade">
        <TouchableOpacity style={styles.modalOverlay} onPress={() => setShowMonthPicker(false)}>
          <View style={styles.modalSheet}>
            <ScrollView>
              <TouchableOpacity style={styles.modalItem} onPress={() => { setFilterMonth(""); setShowMonthPicker(false); }}>
                <Text style={[styles.modalItemText, !filterMonth && styles.modalItemActive]}>すべての月</Text>
              </TouchableOpacity>
              {months.map((m) => (
                <TouchableOpacity key={m} style={styles.modalItem} onPress={() => { setFilterMonth(m); setShowMonthPicker(false); }}>
                  <Text style={[styles.modalItemText, filterMonth === m && styles.modalItemActive]}>{parseInt(m)}月</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f3ea",
    padding: 16,
  },
  filterRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  picker: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fdfaf3",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  pickerText: {
    fontSize: 14,
    color: "#2c2416",
    fontFamily: FONT_SERIF,
  },
  pickerCaret: {
    fontSize: 12,
    color: "#8a7560",
  },
  searchRow: {
    position: "relative",
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: "#fdfaf3",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#2c2416",
    fontFamily: FONT_SERIF,
  },
  searchIndicator: {
    position: "absolute",
    right: 12,
    top: "50%",
  },
  emptyText: {
    color: "#8a7560",
    padding: 12,
    textAlign: "center",
    marginTop: 20,
    fontFamily: FONT_SERIF,
  },
  card: {
    backgroundColor: "#fdfaf3",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 6,
    padding: 16,
  },
  cardDate: {
    fontSize: 12,
    color: "#8a7560",
    marginBottom: 4,
    fontFamily: FONT_SERIF,
  },
  cardName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2c2416",
    lineHeight: 24,
    fontFamily: FONT_SERIF,
  },
  cardSub: {
    fontSize: 13,
    color: "#8a7560",
    marginTop: 4,
    fontFamily: FONT_SERIF,
  },
  editButton: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d6c9b0",
    backgroundColor: "#fdfaf3",
  },
  editButtonText: {
    fontSize: 12,
    color: "#8a7560",
    fontFamily: FONT_SERIF,
  },
  deleteButton: {
    position: "absolute",
    top: 48,
    right: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#e5b8ae",
    backgroundColor: "#fdfaf3",
    minWidth: 44,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 12,
    color: "#c0392b",
    fontFamily: FONT_SERIF,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSheet: {
    backgroundColor: "#fdfaf3",
    borderRadius: 12,
    width: "80%",
    maxHeight: 340,
    paddingBottom: 8,
  },
  modalItem: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8d8",
  },
  modalItemText: {
    fontSize: 16,
    color: "#2c2416",
    fontFamily: FONT_SERIF,
  },
  modalItemActive: {
    color: "#4a7c59",
    fontWeight: "600",
  },
});
