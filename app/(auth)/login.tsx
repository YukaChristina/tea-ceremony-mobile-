import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";
import { makeRedirectUri } from "expo-auth-session";
import { supabase } from "@/lib/supabase";
import { FONT_SERIF } from "@/lib/fonts";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("エラー", "メールアドレスとパスワードを入力してください");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) Alert.alert("ログイン失敗", error.message);
  };

  const handleAppleLogin = async () => {
    setLoading(true);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (credential.identityToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: credential.identityToken,
        });
        if (error) Alert.alert("エラー", error.message);
      }
    } catch (e: any) {
      if (e.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("エラー", "Appleサインインに失敗しました");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      if (Platform.OS === "web") {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) Alert.alert("エラー", error.message);
      } else {
        const redirectUri = makeRedirectUri({ scheme: "teaceremony", path: "auth-callback" });
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
          },
        });
        if (error || !data.url) {
          Alert.alert("エラー", error?.message ?? "URLの取得に失敗しました");
          return;
        }
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);
        if (result.type === "success" && result.url) {
          const url = new URL(result.url);
          const code = url.searchParams.get("code");
          if (code) {
            const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);
            if (sessionError) Alert.alert("エラー", sessionError.message);
          } else if (url.hash) {
            const hashParams = new URLSearchParams(url.hash.substring(1));
            const access_token = hashParams.get("access_token");
            const refresh_token = hashParams.get("refresh_token");
            if (access_token && refresh_token) {
              const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
              if (sessionError) Alert.alert("エラー", sessionError.message);
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <View style={styles.decorLine}>
          <View style={styles.line} />
          <Text style={styles.schoolName}>茶道</Text>
          <View style={styles.line} />
        </View>

        <Text style={styles.title}>稽古日誌</Text>
        <Text style={styles.subtitle}>Sado Practice Log</Text>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="メールアドレス"
            placeholderTextColor="#8a7560"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={styles.input}
            placeholder="パスワード"
            placeholderTextColor="#8a7560"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>ログイン</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>または</Text>
            <View style={styles.dividerLine} />
          </View>

          {Platform.OS === "ios" && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={4}
              style={styles.appleButton}
              onPress={handleAppleLogin}
            />
          )}

          <TouchableOpacity
            style={[styles.googleButton, loading && styles.buttonDisabled]}
            onPress={handleGoogleLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.googleButtonText}>Googleでログイン</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.diamond}>◇</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f3ea",
  },
  inner: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  decorLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
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
    marginBottom: 24,
    fontFamily: FONT_SERIF,
  },
  form: {
    width: "100%",
    gap: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: "#2c2416",
    backgroundColor: "#fdfaf3",
    fontFamily: FONT_SERIF,
  },
  button: {
    backgroundColor: "#4a7c59",
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    letterSpacing: 2,
    fontWeight: "500",
    fontFamily: FONT_SERIF,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 4,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#d6c9b0",
  },
  dividerText: {
    fontSize: 12,
    color: "#8a7560",
    fontFamily: FONT_SERIF,
  },
  appleButton: {
    width: "100%",
    height: 50,
  },
  googleButton: {
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: "#fdfaf3",
  },
  googleButtonText: {
    color: "#2c2416",
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1,
    fontWeight: "500",
    fontFamily: FONT_SERIF,
  },
  diamond: {
    fontSize: 20,
    color: "#4a7c59",
    opacity: 0.4,
    marginTop: 16,
  },
});
