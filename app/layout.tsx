import "@/styles/globals.css";
import type { Metadata } from "next";
import { AppHeader } from "@/components/layout/AppHeader";

export const metadata: Metadata = {
  title: "AP Story App",
  description: "APモデルに基づく編集・小説生成アプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>
        <AppHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}