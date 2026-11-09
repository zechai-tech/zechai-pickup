import type { Metadata, Viewport } from 'next';
import { Archivo } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { PhoneFrame } from '@/components/ui/PhoneFrame';

const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  display: 'swap',
  axes: ['wdth'],
});

export const metadata: Metadata = {
  title: 'Zécha! — One Cup Every Day',
  description: 'Skip the queue. Order ahead, pay online and collect it hot the moment it is ready.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body className="antialiased min-h-screen">
        <ToastProvider>
          <PhoneFrame>{children}</PhoneFrame>
        </ToastProvider>
      </body>
    </html>
  );
}
