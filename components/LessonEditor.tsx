import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
  Platform,
} from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { FONT_SERIF } from "@/lib/fonts";

const withSerif = <T extends Record<string, object>>(styleMap: T): T =>
  Object.fromEntries(
    Object.entries(styleMap).map(([key, value]) => [key, { fontFamily: FONT_SERIF, ...value }])
  ) as T;

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

type TabKey = "chashitsu" | "teishu" | "kyaku";
type Mode = "read" | "new" | "edit";

type LessonItem = {
  item_id: number;
  role_entry_id: number | null;
  section: string;
  item_type: string;
  title: string;
  mei?: string | null;
  maker?: string | null;
  note?: string | null;
};

type RoleEntry = {
  role_entry_id: number;
  role: string;
  temae_name?: string | null;
  note?: string | null;
  items?: LessonItem[];
};

type RoleForm = {
  teaType: "薄茶" | "濃茶";
  hasShelf: "なし" | "あり";
  shelfName: string;
  practiceName: string;
  chawanGosho: string;
  chawanMaker: string;
  chawanMei: string;
  chawanNote: string;
  chashakuMaker: string;
  chashakuMei: string;
  chashakuNote: string;
  chakiNuri: string;
  chakiKatachi: string;
  chakiKatachiKoicha: string;
  chakiKamamoto: string;
  shifukuKirejie: string;
  shifukuShitate: string;
  memo: string;
};

type Props = {
  mode: Mode;
  lesson: { id?: number | null; practiced_on: string; practice_name: string };
  tabs: {
    chashitsu: { items: LessonItem[] };
    teishu: { entries: RoleEntry[] };
    kyaku: { entries: RoleEntry[] };
  };
  initialPhotos?: { id: number; url: string }[];
  onSave?: (payload: { practiced_on: string; practice_name: string }) => Promise<{ lesson_id: number }>;
};

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function defaultSeason(): "風炉" | "炉" {
  const m = new Date().getMonth() + 1;
  return m === 12 || m <= 4 ? "炉" : "風炉";
}

function parsePracticeName(name: string) {
  const parts = name.split("/");
  if (parts.length >= 3) {
    const tea = parts[0] === "濃茶" ? "濃茶" as const : "薄茶" as const;
    const shelfRaw = parts[1];
    const practice = parts.slice(2).join("/");
    const hasShelf = shelfRaw === "なし" ? "なし" as const : "あり" as const;
    const shelfName = shelfRaw === "なし" ? "" : shelfRaw;
    return { teaType: tea, hasShelf, shelfName, practiceName: practice };
  }
  return { teaType: "薄茶" as const, hasShelf: "なし" as const, shelfName: "", practiceName: name };
}

function initFromTabs(tabs: Props["tabs"]) {
  const chItems = tabs.chashitsu.items;
  const okashi = chItems.find((i) => i.item_type === "okashi");
  const kakejiku = chItems.find((i) => i.item_type === "kakejiku");
  const hana = chItems.find((i) => i.item_type === "hana");
  const extras = chItems.filter((i) => !["okashi", "kakejiku", "hana"].includes(i.item_type));
  return {
    okashiGosho: okashi?.title ?? "",
    okashiMei: okashi?.mei ?? "",
    kakejiku: kakejiku?.note ?? "",
    hana: hana?.note ?? "",
    extraItems: extras.map((i) => ({ name: i.item_type, text: i.note ?? "" })),
  };
}

function initRoleForm(entry: RoleEntry | undefined, nameStr: string): RoleForm {
  const items: LessonItem[] = entry?.items ?? [];
  const chawan = items.find((i) => i.item_type === "chawan");
  const chashaku = items.find((i) => i.item_type === "chashaku");
  const chaki = items.find((i) => i.item_type === "chaki");
  const shifuku = items.find((i) => i.item_type === "shifuku");
  const source = entry?.temae_name && entry.temae_name.includes("/") ? entry.temae_name : nameStr;
  const parsed = parsePracticeName(source);
  return {
    teaType: parsed.teaType,
    hasShelf: parsed.hasShelf,
    shelfName: parsed.shelfName,
    practiceName: parsed.practiceName,
    chawanGosho: chawan?.title ?? "",
    chawanMaker: chawan?.maker ?? "",
    chawanMei: chawan?.mei ?? "",
    chawanNote: chawan?.note ?? "",
    chashakuMaker: chashaku?.maker ?? "",
    chashakuMei: chashaku?.mei ?? "",
    chashakuNote: chashaku?.note ?? "",
    chakiNuri: chaki?.note ?? "",
    chakiKatachi: chaki?.title ?? "",
    chakiKatachiKoicha: chaki?.title ?? "",
    chakiKamamoto: chaki?.maker ?? "",
    shifukuKirejie: shifuku?.title ?? "",
    shifukuShitate: shifuku?.maker ?? "夕湖",
    memo: entry?.note ?? "",
  };
}

const EXTRA_ITEM_OPTIONS = ["釜", "花入", "風炉先", "建水", "蓋置", "菓子器", "香合", "水指"];

const ITEM_TYPE_LABELS: Record<string, string> = {
  chawan: "茶碗",
  chashaku: "茶杓",
  chaki: "茶器",
  shifuku: "仕覆",
  okashi: "お菓子",
  kakejiku: "掛け軸",
  hana: "花",
};

function itemTypeLabel(itemType: string): string {
  return ITEM_TYPE_LABELS[itemType] ?? itemType;
}

// 保存形式は "茶の種類/棚の状態/稽古名"（例: "薄茶/なし/貴人点て"）。
// 棚が「なし」のときはその区切りを表示から省く。
function formatTemaeName(raw: string): string {
  const parts = raw.split("/");
  if (parts.length < 3) return raw;
  const [teaType, shelfPart, ...rest] = parts;
  const practiceName = rest.join("/");
  if (shelfPart === "なし") return `${teaType} ${practiceName}`;
  return `${teaType} ${shelfPart} ${practiceName}`;
}

export default function LessonEditor({ mode, lesson, tabs, initialPhotos, onSave }: Props) {
  const router = useRouter();
  const [active, setActive] = useState<TabKey>("chashitsu");
  const init = initFromTabs(tabs);

  const [practicedOn, setPracticedOn] = useState(lesson.practiced_on || todayString());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(new Date(lesson.practiced_on || todayString()));
  const [season, setSeason] = useState<"風炉" | "炉">(defaultSeason());

  // 茶室
  const [existingPhotos, setExistingPhotos] = useState<{ id: number; url: string }[]>(initialPhotos ?? []);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);
  const [newPhotoUris, setNewPhotoUris] = useState<Array<{ uri: string; name: string; type: string }>>([]);
  const [okashiGosho, setOkashiGosho] = useState(init.okashiGosho);
  const [okashiMei, setOkashiMei] = useState(init.okashiMei);
  const [kakejiku, setKakejiku] = useState(init.kakejiku);
  const [hana, setHana] = useState(init.hana);
  const [extraItems, setExtraItems] = useState<{ name: string; text: string }[]>(init.extraItems);

  // 亭主・客
  const [teishuForm, setTeishuForm] = useState<RoleForm>(() =>
    initRoleForm(tabs.teishu.entries[0], lesson.practice_name ?? "")
  );
  const [kyakuForm, setKyakuForm] = useState<RoleForm>(() =>
    initRoleForm(tabs.kyaku.entries[0], lesson.practice_name ?? "")
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editable = mode === "new" || mode === "edit";

  const rf = active === "teishu" ? teishuForm : kyakuForm;
  const setRf = active === "teishu" ? setTeishuForm : setKyakuForm;
  const updateRf = (field: keyof RoleForm, value: string) =>
    setRf((prev) => ({ ...prev, [field]: value } as RoleForm));

  const pickPhotos = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;
    setNewPhotoUris((prev) => [
      ...prev,
      ...result.assets.map((a) => ({
        uri: a.uri,
        name: a.fileName ?? "photo.jpg",
        type: a.mimeType ?? "image/jpeg",
      })),
    ]);
  };

  const handleDeletePhoto = (photo: { id: number; url: string }) => {
    Alert.alert("この写真を削除しますか?", "この操作は取り消せません。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "削除する",
        style: "destructive",
        onPress: async () => {
          setDeletingPhotoId(photo.id);
          try {
            const res = await apiFetch(`/photos/${photo.id}`, { method: "DELETE" });
            if (!res.ok) throw new Error(`削除に失敗しました: ${res.status}`);
            setExistingPhotos((prev) => prev.filter((p) => p.id !== photo.id));
          } catch (e: any) {
            Alert.alert("エラー", e?.message ?? "削除に失敗しました");
          } finally {
            setDeletingPhotoId(null);
          }
        },
      },
    ]);
  };

  const handleSave = async () => {
    if (!onSave) return;
    if (!practicedOn && !teishuForm.practiceName) {
      Alert.alert("入力エラー", "稽古日と稽古名を入力してください");
      return;
    }
    if (!practicedOn) {
      Alert.alert("入力エラー", "稽古日を入力してください");
      return;
    }
    if (!teishuForm.practiceName) {
      Alert.alert("入力エラー", "稽古名を入力してください");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const tf = teishuForm;
      const kf = kyakuForm;
      const tfShelfPart = tf.hasShelf === "あり" ? (tf.shelfName || "棚あり") : "なし";
      const composedName = `${tf.teaType}/${tfShelfPart}/${tf.practiceName}`;

      const { lesson_id } = await onSave({ practiced_on: practicedOn, practice_name: composedName });

      const postItem = async (body: object) => {
        const res = await apiFetch(`/lessons/${lesson_id}/items`, {
          method: "POST",
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`アイテム保存失敗: ${res.status}`);
      };
      const postEntry = (body: object) =>
        apiFetch(`/lessons/${lesson_id}/role-entries`, {
          method: "POST",
          body: JSON.stringify(body),
        }).then((r) => r.json());

      const has = (...vals: string[]) => vals.some((v) => v.trim() !== "");

      if (mode === "edit") {
        await apiFetch(`/lessons/${lesson_id}/items`, { method: "DELETE" });
        await apiFetch(`/lessons/${lesson_id}/role-entries`, { method: "DELETE" });
      }

      // 茶室
      if (has(okashiGosho, okashiMei))
        await postItem({ section: "chashitsu", item_type: "okashi", title: okashiGosho || null, mei: okashiMei || null });
      if (kakejiku.trim())
        await postItem({ section: "chashitsu", item_type: "kakejiku", note: kakejiku });
      if (hana.trim())
        await postItem({ section: "chashitsu", item_type: "hana", note: hana });
      for (const item of extraItems)
        if (item.text.trim())
          await postItem({ section: "chashitsu", item_type: item.name, note: item.text });

      // 亭主
      const tfComposed = `${tf.teaType}/${tfShelfPart}/${tf.practiceName}`;
      const teishuRes = await postEntry({ role: "teishu", temae_name: tfComposed, note: tf.memo || null });
      const teishuEntryId = teishuRes.role_entry.id;
      if (has(tf.chawanGosho, tf.chawanMaker, tf.chawanMei, tf.chawanNote))
        await postItem({ role_entry_id: teishuEntryId, item_type: "chawan", title: tf.chawanGosho || null, maker: tf.chawanMaker || null, mei: tf.chawanMei || null, note: tf.chawanNote || null });
      if (has(tf.chashakuMaker, tf.chashakuMei, tf.chashakuNote))
        await postItem({ role_entry_id: teishuEntryId, item_type: "chashaku", maker: tf.chashakuMaker || null, mei: tf.chashakuMei || null, note: tf.chashakuNote || null });
      if (tf.teaType === "薄茶" && has(tf.chakiNuri, tf.chakiKatachi))
        await postItem({ role_entry_id: teishuEntryId, item_type: "chaki", title: tf.chakiKatachi || null, note: tf.chakiNuri || null });
      if (tf.teaType === "濃茶") {
        if (has(tf.chakiKatachiKoicha, tf.chakiKamamoto))
          await postItem({ role_entry_id: teishuEntryId, item_type: "chaki", title: tf.chakiKatachiKoicha || null, maker: tf.chakiKamamoto || null });
        if (has(tf.shifukuKirejie, tf.shifukuShitate))
          await postItem({ role_entry_id: teishuEntryId, item_type: "shifuku", title: tf.shifukuKirejie || null, maker: tf.shifukuShitate || null });
      }

      // 客
      const kfShelfPart = kf.hasShelf === "あり" ? (kf.shelfName || "棚あり") : "なし";
      const kfComposed = `${kf.teaType}/${kfShelfPart}/${kf.practiceName}`;
      const kyakuRes = await postEntry({ role: "kyaku", temae_name: kfComposed, note: kf.memo || null });
      const kyakuEntryId = kyakuRes.role_entry.id;
      if (has(kf.chawanGosho, kf.chawanMaker, kf.chawanMei, kf.chawanNote))
        await postItem({ role_entry_id: kyakuEntryId, item_type: "chawan", title: kf.chawanGosho || null, maker: kf.chawanMaker || null, mei: kf.chawanMei || null, note: kf.chawanNote || null });
      if (has(kf.chashakuMaker, kf.chashakuMei, kf.chashakuNote))
        await postItem({ role_entry_id: kyakuEntryId, item_type: "chashaku", maker: kf.chashakuMaker || null, mei: kf.chashakuMei || null, note: kf.chashakuNote || null });
      if (kf.teaType === "薄茶" && has(kf.chakiNuri, kf.chakiKatachi))
        await postItem({ role_entry_id: kyakuEntryId, item_type: "chaki", title: kf.chakiKatachi || null, note: kf.chakiNuri || null });
      if (kf.teaType === "濃茶") {
        if (has(kf.chakiKatachiKoicha, kf.chakiKamamoto))
          await postItem({ role_entry_id: kyakuEntryId, item_type: "chaki", title: kf.chakiKatachiKoicha || null, maker: kf.chakiKamamoto || null });
        if (has(kf.shifukuKirejie, kf.shifukuShitate))
          await postItem({ role_entry_id: kyakuEntryId, item_type: "shifuku", title: kf.shifukuKirejie || null, maker: kf.shifukuShitate || null });
      }

      // 写真アップロード
      for (const newPhoto of newPhotoUris) {
        const fileBlob = await (await fetch(newPhoto.uri)).blob();
        const formData = new FormData();
        formData.append("file", fileBlob, newPhoto.name);
        formData.append("upload_preset", UPLOAD_PRESET);
        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: formData }
        );
        if (!uploadRes.ok) throw new Error(`写真アップロード失敗: ${uploadRes.status}`);
        const { secure_url } = await uploadRes.json();
        const saveRes = await apiFetch(`/lessons/${lesson_id}/photos`, {
          method: "POST",
          body: JSON.stringify({ url: secure_url }),
        });
        if (!saveRes.ok) throw new Error(`写真の保存に失敗しました: ${saveRes.status}`);
        const { photo: savedPhoto } = await saveRes.json();
        setExistingPhotos((prev) => [...prev, { id: savedPhoto.id, url: savedPhoto.url }]);
      }
      setNewPhotoUris([]);

      Alert.alert("保存しました", undefined, [
        {
          text: "OK",
          onPress: () => {
            if (mode === "new") {
              router.replace(`/lessons/${lesson_id}/edit`);
            }
          },
        },
      ]);
    } catch (e: any) {
      setError(e?.message ?? "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 60 }}>
      {/* 日付・季節ヘッダー */}
      {editable ? (
        <View style={styles.headerSection}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>稽古日</Text>
              <TouchableOpacity
                style={styles.dateButton}
                onPress={() => {
                  setTempDate(new Date(practicedOn));
                  setShowDatePicker(true);
                }}
              >
                <Text style={styles.dateButtonText}>{practicedOn}</Text>
              </TouchableOpacity>
              {showDatePicker && (
                <>
                  <DateTimePicker
                    value={tempDate}
                    mode="date"
                    display={Platform.OS === "ios" ? "spinner" : "default"}
                    onChange={(_, date) => {
                      if (!date) {
                        // Androidの標準ピッカーは「キャンセル」でdateがundefinedになる
                        setShowDatePicker(false);
                        return;
                      }
                      if (Platform.OS === "android") {
                        // Android標準ピッカーは選択確定時にのみonChangeが呼ばれるため即反映
                        setShowDatePicker(false);
                        setPracticedOn(date.toISOString().split("T")[0]);
                      } else {
                        // iOSのspinnerは月・日を動かすたびonChangeが呼ばれるため、
                        // ここでは一時保存だけして確定ボタンで反映する
                        setTempDate(date);
                      }
                    }}
                    maximumDate={new Date()}
                  />
                  {Platform.OS === "ios" && (
                    <View style={styles.dateConfirmRow}>
                      <TouchableOpacity
                        style={styles.dateConfirmButton}
                        onPress={() => setShowDatePicker(false)}
                      >
                        <Text style={styles.dateConfirmCancelText}>キャンセル</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.dateConfirmButton}
                        onPress={() => {
                          setPracticedOn(tempDate.toISOString().split("T")[0]);
                          setShowDatePicker(false);
                        }}
                      >
                        <Text style={styles.dateConfirmText}>決定</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              )}
            </View>

            <View>
              <Text style={styles.label}>季節</Text>
              <View style={styles.radioRow}>
                {(["風炉", "炉"] as const).map((val) => (
                  <TouchableOpacity
                    key={val}
                    style={styles.radioItem}
                    onPress={() => setSeason(val)}
                  >
                    <View style={[styles.radio, season === val && styles.radioActive]}>
                      {season === val && <View style={styles.radioDot} />}
                    </View>
                    <Text style={styles.radioLabel}>{val}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : (
        <Text style={styles.readDate}>{lesson.practiced_on}</Text>
      )}

      {/* 3タブ */}
      <View style={styles.tabRow}>
        {(["chashitsu", "teishu", "kyaku"] as TabKey[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, active === tab && styles.tabActive]}
            onPress={() => setActive(tab)}
          >
            <Text style={[styles.tabText, active === tab && styles.tabTextActive]}>
              {tab === "chashitsu" ? "茶室" : tab === "teishu" ? "亭主" : "客"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 亭主・客タブの上部入力 */}
      {editable && active !== "chashitsu" && (
        <View style={styles.section}>
          {/* お茶の種類 */}
          <Text style={styles.sectionLabel}>お茶の種類</Text>
          <View style={styles.radioRow}>
            {(["薄茶", "濃茶"] as const).map((val) => (
              <TouchableOpacity
                key={val}
                style={styles.radioItem}
                onPress={() => setRf((prev) => ({ ...prev, teaType: val }))}
              >
                <View style={[styles.radio, rf.teaType === val && styles.radioActive]}>
                  {rf.teaType === val && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>{val}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* 棚 */}
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>棚</Text>
          <View style={styles.radioRow}>
            {(["なし", "あり"] as const).map((val) => (
              <TouchableOpacity
                key={val}
                style={styles.radioItem}
                onPress={() => setRf((prev) => ({ ...prev, hasShelf: val }))}
              >
                <View style={[styles.radio, rf.hasShelf === val && styles.radioActive]}>
                  {rf.hasShelf === val && <View style={styles.radioDot} />}
                </View>
                <Text style={styles.radioLabel}>{val}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {rf.hasShelf === "あり" && (
            <TextInput
              style={[styles.input, { marginTop: 8 }]}
              placeholder="棚の名前（例：志野棚）"
              placeholderTextColor="#8a7560"
              value={rf.shelfName}
              onChangeText={(v) => updateRf("shelfName", v)}
            />
          )}

          {/* 稽古名 */}
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>稽古名</Text>
          <TextInput
            style={styles.input}
            placeholder="例：貴人点て"
            placeholderTextColor="#8a7560"
            value={rf.practiceName}
            onChangeText={(v) => updateRf("practiceName", v)}
          />

          {/* 茶碗 */}
          <Text style={[styles.groupLabel, { marginTop: 16 }]}>茶碗</Text>
          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>御生</Text>
              <TextInput style={styles.input} placeholder="御生" placeholderTextColor="#8a7560" value={rf.chawanGosho} onChangeText={(v) => updateRf("chawanGosho", v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>作者</Text>
              <TextInput style={styles.input} placeholder="作者" placeholderTextColor="#8a7560" value={rf.chawanMaker} onChangeText={(v) => updateRf("chawanMaker", v)} />
            </View>
          </View>
          {rf.teaType === "濃茶" && (
            <TextInput style={[styles.input, { marginTop: 6 }]} placeholder="銘" placeholderTextColor="#8a7560" value={rf.chawanMei} onChangeText={(v) => updateRf("chawanMei", v)} />
          )}
          <TextInput style={[styles.textarea, { marginTop: 6 }]} placeholder="メモ" placeholderTextColor="#8a7560" value={rf.chawanNote} onChangeText={(v) => updateRf("chawanNote", v)} multiline numberOfLines={3} />

          {/* 茶杓 */}
          <Text style={[styles.groupLabel, { marginTop: 16 }]}>茶杓</Text>
          <View style={styles.inputRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>作者</Text>
              <TextInput style={styles.input} placeholder="作者" placeholderTextColor="#8a7560" value={rf.chashakuMaker} onChangeText={(v) => updateRf("chashakuMaker", v)} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>銘</Text>
              <TextInput style={styles.input} placeholder="銘" placeholderTextColor="#8a7560" value={rf.chashakuMei} onChangeText={(v) => updateRf("chashakuMei", v)} />
            </View>
          </View>
          <TextInput style={[styles.textarea, { marginTop: 6 }]} placeholder="メモ" placeholderTextColor="#8a7560" value={rf.chashakuNote} onChangeText={(v) => updateRf("chashakuNote", v)} multiline numberOfLines={3} />

          {/* 茶器（薄茶） */}
          {rf.teaType === "薄茶" && (
            <>
              <Text style={[styles.groupLabel, { marginTop: 16 }]}>茶器</Text>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>塗り</Text>
                  <TextInput style={styles.input} placeholder="塗り" placeholderTextColor="#8a7560" value={rf.chakiNuri} onChangeText={(v) => updateRf("chakiNuri", v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>形</Text>
                  <TextInput style={styles.input} placeholder="形" placeholderTextColor="#8a7560" value={rf.chakiKatachi} onChangeText={(v) => updateRf("chakiKatachi", v)} />
                </View>
              </View>
            </>
          )}

          {/* 茶器・仕覆（濃茶） */}
          {rf.teaType === "濃茶" && (
            <>
              <Text style={[styles.groupLabel, { marginTop: 16 }]}>茶器</Text>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>形</Text>
                  <TextInput style={styles.input} placeholder="形" placeholderTextColor="#8a7560" value={rf.chakiKatachiKoicha} onChangeText={(v) => updateRf("chakiKatachiKoicha", v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>窯元</Text>
                  <TextInput style={styles.input} placeholder="窯元" placeholderTextColor="#8a7560" value={rf.chakiKamamoto} onChangeText={(v) => updateRf("chakiKamamoto", v)} />
                </View>
              </View>
              <Text style={[styles.groupLabel, { marginTop: 16 }]}>仕覆</Text>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>切地</Text>
                  <TextInput style={styles.input} placeholder="切地" placeholderTextColor="#8a7560" value={rf.shifukuKirejie} onChangeText={(v) => updateRf("shifukuKirejie", v)} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>仕立て</Text>
                  <TextInput style={styles.input} value={rf.shifukuShitate} onChangeText={(v) => updateRf("shifukuShitate", v)} />
                </View>
              </View>
            </>
          )}

          {/* メモ */}
          <Text style={[styles.sectionLabel, { marginTop: 16 }]}>メモ</Text>
          <TextInput
            style={styles.textarea}
            placeholder={active === "teishu" ? "点前の反省、先生からの指摘など" : "拝見、挨拶、気づきなど"}
            placeholderTextColor="#8a7560"
            value={rf.memo}
            onChangeText={(v) => updateRf("memo", v)}
            multiline
            numberOfLines={5}
          />
        </View>
      )}

      {/* 茶室タブ */}
      {active === "chashitsu" && (
        <View style={styles.section}>
          {mode === "read" ? (
            <>
              {(tabs.chashitsu.items ?? []).length === 0 ? (
                <Text style={styles.emptyText}>記録がありません</Text>
              ) : (
                (tabs.chashitsu.items ?? []).map((it) => (
                  <View key={it.item_id} style={styles.readCard}>
                    <Text style={styles.readCardTitle}>{itemTypeLabel(it.item_type)}</Text>
                    {it.title && (
                      <Text style={styles.readCardLine}>
                        {it.item_type === "okashi" ? "御生" : "名称"}: {it.title}
                      </Text>
                    )}
                    {it.mei && <Text style={styles.readCardLine}>銘: {it.mei}</Text>}
                    {it.maker && <Text style={styles.readCardLine}>作: {it.maker}</Text>}
                    {it.note && <Text style={styles.readCardLine}>{it.note}</Text>}
                  </View>
                ))
              )}
              {existingPhotos.length > 0 && (
                <>
                  <Text style={[styles.groupLabel, { marginTop: 14 }]}>写真</Text>
                  <View style={styles.photoGrid}>
                    {existingPhotos.map((photo) => (
                      <Image key={photo.id} source={{ uri: photo.url }} style={styles.photoThumb} />
                    ))}
                  </View>
                </>
              )}
            </>
          ) : (
            <>
              {/* お菓子 */}
              <Text style={styles.groupLabel}>お菓子</Text>
              <View style={styles.inputRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>御生</Text>
                  <TextInput style={styles.input} placeholder="御生" placeholderTextColor="#8a7560" value={okashiGosho} onChangeText={setOkashiGosho} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>銘</Text>
                  <TextInput style={styles.input} placeholder="銘" placeholderTextColor="#8a7560" value={okashiMei} onChangeText={setOkashiMei} />
                </View>
              </View>

              {/* 掛け軸 */}
              <Text style={[styles.groupLabel, { marginTop: 14 }]}>掛け軸</Text>
              <TextInput style={styles.textarea} placeholder="掛け軸について記入" placeholderTextColor="#8a7560" value={kakejiku} onChangeText={setKakejiku} multiline numberOfLines={3} />

              {/* 花 */}
              <Text style={[styles.groupLabel, { marginTop: 14 }]}>花</Text>
              <TextInput style={styles.textarea} placeholder="花について記入" placeholderTextColor="#8a7560" value={hana} onChangeText={setHana} multiline numberOfLines={3} />

              {/* 追加項目 */}
              {extraItems.map((item, i) => (
                <View key={i}>
                  <View style={[styles.inputRow, { marginTop: 14, alignItems: "center" }]}>
                    <Text style={[styles.groupLabel, { marginBottom: 0, flex: 1 }]}>{item.name}</Text>
                    <TouchableOpacity onPress={() => setExtraItems((prev) => prev.filter((_, idx) => idx !== i))}>
                      <Text style={styles.deleteText}>削除</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.textarea, { marginTop: 4 }]}
                    placeholder={`${item.name}について記入`}
                    placeholderTextColor="#8a7560"
                    value={item.text}
                    onChangeText={(v) => setExtraItems((prev) => prev.map((it, idx) => idx === i ? { ...it, text: v } : it))}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              ))}

              {/* 追加ボタン */}
              <View style={[styles.inputRow, { marginTop: 14, flexWrap: "wrap", gap: 8 }]}>
                {EXTRA_ITEM_OPTIONS.map((name) => (
                  <TouchableOpacity
                    key={name}
                    style={styles.addChip}
                    onPress={() => setExtraItems((prev) => [...prev, { name, text: "" }])}
                  >
                    <Text style={styles.addChipText}>＋ {name}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* 写真 */}
              <Text style={[styles.groupLabel, { marginTop: 14 }]}>写真</Text>
              <TouchableOpacity style={styles.addPhotoButton} onPress={pickPhotos}>
                <Text style={styles.addPhotoText}>＋ 写真を追加</Text>
              </TouchableOpacity>
              <View style={styles.photoGrid}>
                {existingPhotos.map((photo) => (
                  <View key={`e-${photo.id}`} style={styles.photoThumbWrap}>
                    <Image source={{ uri: photo.url }} style={styles.photoThumb} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => handleDeletePhoto(photo)}
                      disabled={deletingPhotoId === photo.id}
                    >
                      {deletingPhotoId === photo.id ? (
                        <ActivityIndicator size="small" color="#fff" />
                      ) : (
                        <Text style={styles.photoRemoveText}>✕</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                ))}
                {newPhotoUris.map((p, i) => (
                  <View key={`n-${i}`} style={styles.photoThumbWrap}>
                    <Image source={{ uri: p.uri }} style={[styles.photoThumb, styles.photoThumbNew]} />
                    <TouchableOpacity
                      style={styles.photoRemove}
                      onPress={() => setNewPhotoUris((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Text style={styles.photoRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      )}

      {/* 亭主・客タブの読み取り表示 */}
      {mode === "read" && active !== "chashitsu" && (
        <View style={styles.section}>
          {!(active === "teishu" ? tabs.teishu.entries : tabs.kyaku.entries)?.length ? (
            <Text style={styles.emptyText}>記録がありません</Text>
          ) : (
            (active === "teishu" ? tabs.teishu.entries : tabs.kyaku.entries).map((e) => (
              <View key={e.role_entry_id} style={styles.readCard}>
                <Text style={styles.readCardTitle}>{e.temae_name ? formatTemaeName(e.temae_name) : "点前"}</Text>
                {e.note && <Text style={styles.readCardLine}>{e.note}</Text>}
                {e.items?.map((it) => (
                  <View key={it.item_id} style={styles.readSubCard}>
                    <Text style={styles.readSubCardType}>{itemTypeLabel(it.item_type)}</Text>
                    {it.title && <Text style={styles.readCardLine}>{it.title}</Text>}
                    {it.mei && <Text style={styles.readCardLine}>銘: {it.mei}</Text>}
                    {it.maker && <Text style={styles.readCardLine}>作: {it.maker}</Text>}
                    {it.note && <Text style={styles.readCardLine}>{it.note}</Text>}
                  </View>
                ))}
              </View>
            ))
          )}
        </View>
      )}

      {/* 保存ボタン */}
      {editable && (
        <View style={styles.saveSection}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <TouchableOpacity
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveButtonText}>保存</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create(withSerif({
  container: {
    flex: 1,
    backgroundColor: "#f7f3ea",
  },
  headerSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#d6c9b0",
    backgroundColor: "#fdfaf3",
  },
  headerRow: {
    flexDirection: "row",
    gap: 20,
    alignItems: "flex-end",
  },
  dateButton: {
    backgroundColor: "#f7f3ea",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 4,
  },
  dateButtonText: {
    fontSize: 16,
    color: "#2c2416",
  },
  readDate: {
    fontSize: 13,
    color: "#8a7560",
    padding: 16,
  },
  dateConfirmRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  dateConfirmButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d6c9b0",
    backgroundColor: "#fdfaf3",
    alignItems: "center",
  },
  dateConfirmText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#4a7c59",
  },
  dateConfirmCancelText: {
    fontSize: 14,
    color: "#8a7560",
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#f7f3ea",
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#d6c9b0",
    backgroundColor: "#fdfaf3",
    alignItems: "center",
  },
  tabActive: {
    backgroundColor: "#4a7c59",
    borderColor: "#4a7c59",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#2c2416",
    letterSpacing: 1,
  },
  tabTextActive: {
    color: "#fff",
  },
  section: {
    padding: 16,
    gap: 4,
  },
  sectionLabel: {
    fontSize: 12,
    color: "#8a7560",
    marginBottom: 4,
  },
  groupLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2c2416",
    marginBottom: 6,
  },
  label: {
    fontSize: 11,
    color: "#8a7560",
    marginBottom: 3,
  },
  input: {
    backgroundColor: "#fdfaf3",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#2c2416",
  },
  textarea: {
    backgroundColor: "#fdfaf3",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 15,
    color: "#2c2416",
    textAlignVertical: "top",
    minHeight: 80,
  },
  inputRow: {
    flexDirection: "row",
    gap: 8,
  },
  radioRow: {
    flexDirection: "row",
    gap: 20,
    marginTop: 4,
  },
  radioItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: "#8a7560",
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: {
    borderColor: "#4a7c59",
  },
  radioDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#4a7c59",
  },
  radioLabel: {
    fontSize: 14,
    color: "#2c2416",
  },
  addChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#4a7c59",
    borderStyle: "dashed",
    backgroundColor: "#fdfaf3",
  },
  addChipText: {
    fontSize: 12,
    color: "#4a7c59",
    fontWeight: "600",
  },
  deleteText: {
    fontSize: 13,
    color: "#8a7560",
  },
  addPhotoButton: {
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderStyle: "dashed",
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#fdfaf3",
    marginBottom: 8,
  },
  addPhotoText: {
    fontSize: 14,
    color: "#8a7560",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoThumbWrap: {
    position: "relative",
  },
  photoThumb: {
    width: 90,
    height: 90,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#d6c9b0",
  },
  photoThumbNew: {
    borderWidth: 2,
    borderColor: "#4a7c59",
  },
  photoRemove: {
    position: "absolute",
    top: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.5)",
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  photoRemoveText: {
    color: "#fff",
    fontSize: 11,
  },
  readCard: {
    backgroundColor: "#fdfaf3",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 6,
    padding: 16,
    marginBottom: 12,
    gap: 4,
  },
  readCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#2c2416",
    marginBottom: 4,
  },
  readCardLine: {
    fontSize: 14,
    color: "#8a7560",
  },
  readSubCard: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#f0e8d8",
    gap: 2,
  },
  readSubCardType: {
    fontSize: 12,
    color: "#4a7c59",
    fontWeight: "600",
    marginBottom: 2,
  },
  emptyText: {
    color: "#8a7560",
    fontSize: 14,
    textAlign: "center",
    marginTop: 20,
  },
  saveSection: {
    padding: 16,
    gap: 8,
  },
  saveButton: {
    backgroundColor: "#4a7c59",
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: "500",
  },
  errorText: {
    color: "#c0392b",
    fontSize: 14,
  },
}));
