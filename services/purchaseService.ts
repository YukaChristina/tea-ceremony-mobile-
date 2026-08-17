import Purchases, { LOG_LEVEL, type PurchasesPackage } from "react-native-purchases";

// RevenueCatダッシュボードで作成するEntitlementのID。
const PREMIUM_ENTITLEMENT_ID = "premium";

let isConfigured = false;

export function configurePurchases(): void {
  const apiKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY;
  if (!apiKey) {
    console.warn("EXPO_PUBLIC_REVENUECAT_IOS_KEY が未設定のため、課金機能は無効化されます。");
    return;
  }

  Purchases.setLogLevel(LOG_LEVEL.WARN);
  Purchases.configure({ apiKey });
  isConfigured = true;
}

export async function getPremiumStatus(): Promise<boolean> {
  if (!isConfigured) return false;
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return PREMIUM_ENTITLEMENT_ID in customerInfo.entitlements.active;
  } catch (error) {
    console.error("getPremiumStatus failed", error);
    return false;
  }
}

async function getPremiumPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  const current = offerings.current;
  if (!current) return null;
  // 買い切り（非消耗型）商品は "lifetime" パッケージタイプとしてRevenueCatダッシュボードで設定する想定。
  return current.lifetime ?? current.availablePackages[0] ?? null;
}

export async function getPremiumPriceString(): Promise<string | null> {
  if (!isConfigured) return null;
  try {
    const pkg = await getPremiumPackage();
    return pkg?.product.priceString ?? null;
  } catch (error) {
    console.error("getPremiumPriceString failed", error);
    return null;
  }
}

export async function purchasePremium(): Promise<boolean> {
  if (!isConfigured) return false;

  const pkg = await getPremiumPackage();
  if (!pkg) {
    throw new Error("購入可能な商品が見つかりませんでした。");
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return PREMIUM_ENTITLEMENT_ID in customerInfo.entitlements.active;
  } catch (error: any) {
    if (error?.userCancelled) return false;
    throw error;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (!isConfigured) return false;
  const customerInfo = await Purchases.restorePurchases();
  return PREMIUM_ENTITLEMENT_ID in customerInfo.entitlements.active;
}
