import { useEffect, useRef } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";

// AndroidではGoogleログインのリダイレクトが、ブラウザセッション側(login.tsx)ではなく
// OSのディープリンク経由でこの画面に直接渡ってくることがある。
// その場合でもログインを完了させてホームに戻すための受け皿。
export default function AuthCallbackScreen() {
  const params = useGlobalSearchParams<{
    code?: string;
    access_token?: string;
    refresh_token?: string;
  }>();
  const router = useRouter();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return;
    handledRef.current = true;

    (async () => {
      try {
        if (params.code) {
          await supabase.auth.exchangeCodeForSession(params.code);
        } else if (params.access_token && params.refresh_token) {
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        }
      } catch {
        // すでに別経路でログイン済みの場合などはここで失敗しても問題ない
      } finally {
        router.replace("/(tabs)");
      }
    })();
  }, [params, router]);

  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color="#4a7c59" />
    </View>
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
