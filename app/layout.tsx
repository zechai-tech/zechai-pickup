import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import '@fontsource-variable/archivo/wdth.css';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { PhoneFrame } from '@/components/ui/PhoneFrame';

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

const SUPABASE_ORIGIN = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pdgtdcabbfvhomkpoajw.supabase.co'
    ).origin;
  } catch {
    return 'https://pdgtdcabbfvhomkpoajw.supabase.co';
  }
})();

const CLARITY_ID = process.env.NEXT_PUBLIC_CLARITY_ID || 'zh5ekf4at1';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://checkout.razorpay.com" />
        <link rel="dns-prefetch" href="https://sdk.cashfree.com" />
        <link rel="dns-prefetch" href="https://www.clarity.ms" />
        <link rel="preconnect" href="https://www.clarity.ms" />
        <link rel="preconnect" href="https://c.clarity.ms" />
        <Script
          id="microsoft-clarity"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window, document, "clarity", "script", "${CLARITY_ID}");`,
          }}
        />
        <Script
          src="https://checkout.razorpay.com/v1/checkout.js"
          strategy="lazyOnload"
        />
        <Script
          src="https://sdk.cashfree.com/js/v3/cashfree.js"
          strategy="lazyOnload"
        />
      </head>
      <body className="antialiased min-h-screen">
        <ToastProvider>
          <PhoneFrame>{children}</PhoneFrame>
        </ToastProvider>
      </body>
    </html>
  );
}
