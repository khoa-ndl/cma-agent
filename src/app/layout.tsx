import type { Metadata } from "next";
import "./globals.css";
import { NOT_APPRAISAL_DISCLOSURE, SAMPLE_DATA_DISCLOSURE } from "@/lib/disclosures";

export const metadata: Metadata = {
  title: "CMA Agent",
  description: "AI-assisted comparative market analysis on sample data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col bg-(--color-background) text-(--color-foreground) font-sans">
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="border-t border-(--color-border) px-4 py-4 text-center text-sm text-(--color-muted-foreground)">
          <p>{SAMPLE_DATA_DISCLOSURE}</p>
          <p>{NOT_APPRAISAL_DISCLOSURE}</p>
        </footer>
      </body>
    </html>
  );
}
