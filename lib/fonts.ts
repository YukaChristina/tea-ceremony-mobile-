import { Platform } from "react-native";

export const FONT_SERIF = Platform.select({
  ios: "Hiragino Mincho ProN",
  android: "serif",
  default: "serif",
});
