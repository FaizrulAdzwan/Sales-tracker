import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import SWRegister from '../components/SWRegister';
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});
export const metadata: Metadata = {
  title: 'Sales Insights', // Updated title
  description: 'Track daily sales performance.', // Updated description
};
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}><SWRegister />
        {children}
        <Toaster /> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
