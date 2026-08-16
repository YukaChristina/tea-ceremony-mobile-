import { apiFetch } from "@/lib/api";
import LessonEditor from "@/components/LessonEditor";

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
  const handleSave = async (payload: { practiced_on: string; practice_name: string }) => {
    const res = await apiFetch("/lessons", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`稽古の作成に失敗しました: ${res.status}`);
    return res.json();
  };

  return (
    <LessonEditor
      mode="new"
      lesson={EMPTY_LESSON}
      tabs={EMPTY_TABS}
      onSave={handleSave}
    />
  );
}
