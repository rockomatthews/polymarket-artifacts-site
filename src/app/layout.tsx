import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Polymarket Artifacts",
  description: "Pay $5 USDC on Base and download a Polymarket edge artifact.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif, system-ui" }}>{children}</body>
    </html>
  );
}
