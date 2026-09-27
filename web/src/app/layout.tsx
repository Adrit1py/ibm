import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bob Simulator | Digital Twin',
  description: 'Interactive failure simulation and resilience-testing platform.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased w-full h-screen">
        {children}
      </body>
    </html>
  )
}
