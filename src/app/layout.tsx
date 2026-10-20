import type { Metadata } from "next";
import { config } from "@fortawesome/fontawesome-svg-core";
import "@fortawesome/fontawesome-svg-core/styles.css";
import "./globals.css";
import { sceneArtStyle } from "@/game/assets";
config.autoAddCss = false;
export const metadata: Metadata = {
  title: "同一屋檐下 · 末日家人",
  description: "在末日中活过100天，守住最后一位家人。",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" style={sceneArtStyle}>
      <body>{children}</body>
    </html>
  );
}
