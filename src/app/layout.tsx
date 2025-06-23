import type { Metadata } from 'next';
import { Inter as FontInter, Space_Grotesk as FontSpaceGrotesk, Source_Code_Pro as FontSourceCodePro } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";

const fontInter = FontInter({
  subsets: ['latin'],
  variable: '--font-inter',
});

const fontSpaceGrotesk = FontSpaceGrotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-space-grotesk',
});

const fontSourceCodePro = FontSourceCodePro({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-source-code-pro',
});

export const metadata: Metadata = {
  title: 'RAG Navigator',
  description: 'Index websites and query their content using RAG.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
      </head>
      <body className={`${fontInter.variable} ${fontSpaceGrotesk.variable} ${fontSourceCodePro.variable} font-body antialiased`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
