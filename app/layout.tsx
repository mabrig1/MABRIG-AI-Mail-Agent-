import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'MABRIG AI Mail Agent',
  description: 'Agentic inbox, campaign and deliverability intelligence for MABRIG Mail',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
