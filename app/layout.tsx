import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EdgeWake — Command Centre',
  description: 'Local preview of the EdgeWake command centre.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
