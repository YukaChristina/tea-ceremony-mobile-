import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { getPremiumPriceString, purchasePremium, restorePurchases } from "@/services/purchaseService";
import { FONT_SERIF } from "@/lib/fonts";

const FREE_LESSON_LIMIT = 10;

export default function Paywall({ onUnlock }: { onUnlock: () => void }) {
  const [priceString, setPriceString] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    getPremiumPriceString().then(setPriceString);
  }, []);

  const handlePurchase = async () => {
    setPurchasing(true);
    try {
      const unlocked = await purchasePremium();
      if (unlocked) onUnlock();
    } catch (e: any) {
      Alert.alert("エラー", e?.message ?? "購入処理に失敗しました。もう一度お試しください。");
    } finally {
      setPurchasing(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const unlocked = await restorePurchases();
      if (unlocked) {
        onUnlock();
      } else {
        Alert.alert("購入履歴が見つかりません", "過去の購入が見つかりませんでした。");
      }
    } catch (e: any) {
      Alert.alert("エラー", e?.message ?? "購入の復元に失敗しました。もう一度お試しください。");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.decorLine}>
        <View style={styles.line} />
        <Text style={styles.schoolName}>茶道</Text>
        <View style={styles.line} />
      </View>

      <Text style={styles.title}>無料記録の上限に達しました</Text>
      <Text style={styles.description}>
        無料でご利用いただける稽古の記録は{FREE_LESSON_LIMIT}件までです。引き続き記録するには購入が必要です。一度のお支払いで、以降は無制限に記録できます。
      </Text>

      <View style={styles.priceBox}>
        {priceString ? (
          <Text style={styles.price}>{priceString}</Text>
        ) : (
          <ActivityIndicator size="small" color="#4a7c59" />
        )}
        <Text style={styles.priceNote}>買い切り・追加課金なし</Text>
      </View>

      <TouchableOpacity
        style={[styles.button, (purchasing || restoring) && styles.buttonDisabled]}
        onPress={handlePurchase}
        disabled={purchasing || restoring}
      >
        {purchasing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>購入して続ける</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={handleRestore} disabled={purchasing || restoring}>
        <Text style={styles.restoreText}>{restoring ? "復元中..." : "購入を復元"}</Text>
      </TouchableOpacity>
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
    fontSize: 22,
    fontWeight: "600",
    color: "#2c2416",
    textAlign: "center",
    fontFamily: FONT_SERIF,
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    color: "#8a7560",
    textAlign: "center",
    fontFamily: FONT_SERIF,
  },
  priceBox: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#fdfaf3",
    borderWidth: 1,
    borderColor: "#d6c9b0",
    borderRadius: 8,
    paddingVertical: 20,
    alignItems: "center",
    gap: 8,
  },
  price: {
    fontSize: 28,
    fontWeight: "700",
    color: "#2c2416",
    fontFamily: FONT_SERIF,
  },
  priceNote: {
    fontSize: 12,
    color: "#8a7560",
    fontFamily: FONT_SERIF,
  },
  button: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#4a7c59",
    borderRadius: 4,
    paddingVertical: 16,
    alignItems: "center",
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
  restoreText: {
    fontSize: 14,
    color: "#8a7560",
    fontFamily: FONT_SERIF,
  },
});
