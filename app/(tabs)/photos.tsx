import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch } from "@/lib/api";
import { FONT_SERIF } from "@/lib/fonts";

type Photo = {
  id: number;
  lesson_id: number;
  url: string;
  practiced_on: string;
  practice_name: string;
};

type LessonOption = {
  id: number;
  practiced_on: string;
  practice_name: string;
};

const { width } = Dimensions.get("window");
const THUMB_SIZE = (width - 48) / 3;

const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME!;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET!;

export default function PhotosScreen() {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [lessons, setLessons] = useState<LessonOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Photo | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadLessonId, setUploadLessonId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [showLessonPicker, setShowLessonPicker] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      Promise.all([
        apiFetch("/photos").then((r) => r.json()),
        apiFetch("/lessons").then((r) => r.json()),
      ]).then(([photoData, lessonData]) => {
        setPhotos(Array.isArray(photoData) ? photoData : []);
        setLessons(Array.isArray(lessonData) ? lessonData : []);
      }).finally(() => setLoading(false));
    }, [])
  );

  const pickAndUpload = async () => {
    if (!uploadLessonId) {
      Alert.alert("エラー", "稽古を選択してください");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.85,
    });
    if (result.canceled) return;

    setUploading(true);
    try {
      const newPhotos: Photo[] = [];
      for (const asset of result.assets) {
        const fileBlob = await (await fetch(asset.uri)).blob();
        const formData = new FormData();
        formData.append("file", fileBlob, asset.fileName ?? "photo.jpg");
        formData.append("upload_preset", UPLOAD_PRESET);

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
          { method: "POST", body: formData }
        );
        if (!uploadRes.ok) throw new Error(`アップロード失敗: ${uploadRes.status}`);
        const { secure_url } = await uploadRes.json();

        const saveRes = await apiFetch(`/lessons/${uploadLessonId}/photos`, {
          method: "POST",
          body: JSON.stringify({ url: secure_url }),
        });
        if (!saveRes.ok) throw new Error(`保存失敗: ${saveRes.status}`);
        const { photo } = await saveRes.json();
        const lesson = lessons.find((l) => l.id === Number(uploadLessonId));
        newPhotos.push({
          id: photo.id,
          lesson_id: Number(uploadLessonId),
          url: secure_url,
          practiced_on: lesson?.practiced_on ?? "",
          practice_name: lesson?.practice_name ?? "",
        });
      }
      setPhotos((prev) => [...newPhotos.reverse(), ...prev]);
      setShowUpload(false);
      setUploadLessonId("");
    } catch (e: any) {
      Alert.alert("エラー", e?.message ?? "アップロードに失敗しました");
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = (photo: Photo) => {
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
            setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
            setSelected(null);
            Alert.alert("削除しました");
          } catch (e: any) {
            Alert.alert("エラー", e?.message ?? "削除に失敗しました");
          } finally {
            setDeletingPhotoId(null);
          }
        },
      },
    ]);
  };

  const selectedLesson = lessons.find((l) => l.id === Number(uploadLessonId));

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center" }]}>
        <ActivityIndicator size="large" color="#4a7c59" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.uploadButton} onPress={() => setShowUpload(true)}>
        <Text style={styles.uploadButtonText}>＋ 写真を追加</Text>
      </TouchableOpacity>

      {photos.length === 0 ? (
        <Text style={styles.emptyText}>まだ写真がありません。</Text>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          columnWrapperStyle={{ gap: 4 }}
          contentContainerStyle={{ gap: 4 }}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => setSelected(item)}>
              <Image source={{ uri: item.url }} style={{ width: THUMB_SIZE, height: THUMB_SIZE }} />
            </TouchableOpacity>
          )}
        />
      )}

      {/* 写真詳細モーダル */}
      <Modal visible={!!selected} transparent animationType="fade">
        <View style={styles.photoModalOverlay}>
          <TouchableOpacity style={styles.photoModalClose} onPress={() => setSelected(null)}>
            <Text style={styles.photoModalCloseText}>✕</Text>
          </TouchableOpacity>
          {selected && (
            <>
              <Image source={{ uri: selected.url }} style={styles.photoModalImage} resizeMode="contain" />
              <View style={styles.photoModalInfo}>
                <Text style={styles.photoModalDate}>{selected.practiced_on}</Text>
                <Text style={styles.photoModalName}>{selected.practice_name}</Text>
                <TouchableOpacity onPress={() => { setSelected(null); router.push(`/lessons/${selected.lesson_id}`); }}>
                  <Text style={styles.photoModalLink}>稽古日誌を見る →</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeletePhoto(selected)}
                  disabled={deletingPhotoId === selected.id}
                >
                  {deletingPhotoId === selected.id ? (
                    <ActivityIndicator color="#c0392b" style={{ marginTop: 8 }} />
                  ) : (
                    <Text style={styles.photoModalDelete}>この写真を削除</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* アップロードモーダル（稽古選択もこの中で切り替え表示） */}
      <Modal visible={showUpload} transparent animationType="fade">
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => { setShowUpload(false); setShowLessonPicker(false); }}
        >
          <View style={[styles.modalSheet, showLessonPicker && { maxHeight: 400 }]}>
            {showLessonPicker ? (
              <>
                <Text style={styles.modalTitle}>稽古を選択</Text>
                <ScrollView>
                  {lessons.map((l) => (
                    <TouchableOpacity
                      key={l.id}
                      style={styles.lessonPickerItem}
                      onPress={() => { setUploadLessonId(String(l.id)); setShowLessonPicker(false); }}
                    >
                      <Text style={styles.lessonPickerDate}>{l.practiced_on}</Text>
                      <Text style={styles.lessonPickerName}>{l.practice_name}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            ) : (
              <>
                <Text style={styles.modalTitle}>写真を追加</Text>

                <TouchableOpacity style={styles.pickerButton} onPress={() => setShowLessonPicker(true)}>
                  <Text style={styles.pickerButtonText}>
                    {selectedLesson ? `${selectedLesson.practiced_on} ${selectedLesson.practice_name}` : "稽古を選択 ▾"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionButton, uploading && { opacity: 0.6 }]}
                  onPress={pickAndUpload}
                  disabled={uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionButtonText}>写真を選んでアップロード</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
  uploadButton: {
    backgroundColor: "#4a7c59",
    borderRadius: 4,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 15,
    letterSpacing: 1,
    fontFamily: FONT_SERIF,
  },
  emptyText: {
    color: "#8a7560",
    textAlign: "center",
    marginTop: 40,
    fontFamily: FONT_SERIF,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  photoModalClose: {
    position: "absolute",
    top: 60,
    right: 20,
    zIndex: 10,
  },
  photoModalCloseText: {
    color: "#fff",
    fontSize: 24,
  },
  photoModalImage: {
    width: width,
    height: width,
  },
  photoModalInfo: {
    marginTop: 16,
    alignItems: "center",
    gap: 4,
  },
  photoModalDate: {
    color: "#d6c9b0",
    fontSize: 12,
    fontFamily: FONT_SERIF,
  },
  photoModalName: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    fontFamily: FONT_SERIF,
  },
  photoModalDelete: {
    color: "#e07a6b",
    marginTop: 12,
    fontSize: 13,
    fontFamily: FONT_SERIF,
  },
  photoModalLink: {
    color: "#4a7c59",
    marginTop: 8,
    fontSize: 14,
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
    width: "85%",
    padding: 20,
    gap: 12,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2c2416",
    letterSpacing: 1,
    textAlign: "center",
    marginBottom: 4,
    fontFamily: FONT_SERIF,
  },
  pickerButton: {
    backgroundColor: "#f7f3ea",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerButtonText: {
    fontSize: 14,
    color: "#2c2416",
    fontFamily: FONT_SERIF,
  },
  actionButton: {
    backgroundColor: "#4a7c59",
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 15,
    letterSpacing: 1,
    fontFamily: FONT_SERIF,
  },
  lessonPickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f0e8d8",
  },
  lessonPickerDate: {
    fontSize: 12,
    color: "#8a7560",
    fontFamily: FONT_SERIF,
  },
  lessonPickerName: {
    fontSize: 15,
    color: "#2c2416",
    marginTop: 2,
    fontFamily: FONT_SERIF,
  },
});
