import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter, useSegments } from "expo-router";
import { Session } from "@supabase/supabase-js";
import { FONT_SERIF } from "@/lib/fonts";

function AuthGuard({ session }: { session: Session | null | undefined }) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (session === undefined) return;
    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, segments]);

  return null;
}

export default function RootLayout() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <>
      <AuthGuard session={session} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerTitleStyle: { fontFamily: FONT_SERIF },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="lessons/new" options={{ headerShown: true, title: "稽古を記録する", headerTintColor: "#4a7c59" }} />
        <Stack.Screen name="lessons/[id]/index" options={{ headerShown: true, title: "稽古の詳細", headerTintColor: "#4a7c59" }} />
        <Stack.Screen name="lessons/[id]/edit" options={{ headerShown: true, title: "稽古を編集", headerTintColor: "#4a7c59" }} />
      </Stack>
    </>
  );
}
