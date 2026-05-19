import ServiceWorker from '@/components/ServiceWorker'
import './globals.css'
import { Analytics } from '@vercel/analytics/next'

export const metadata = {
  title: 'Raincast',
  description: 'Hyperlocal rain nowcasting',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#000000" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
      </head>
      <body>
        <ServiceWorker />
        {children}
      </body>
      <Analytics />
    </html>
  )
}