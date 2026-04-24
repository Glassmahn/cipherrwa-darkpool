import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "CipherRWA — Confidential Dark Pool",
  description: "First fully confidential RWA dark pool on Zama FHEVM",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
