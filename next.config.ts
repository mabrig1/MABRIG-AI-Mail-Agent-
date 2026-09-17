import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Next.js 16.3.x + Vercel's build adapter does not emit the whole-app
  // next-server.js.nft.json file that the standalone finalizer expects.
  // Vercel packages Next.js functions itself, so standalone output is only
  // needed for non-Vercel/self-hosted deployments.
  output: process.env.VERCEL ? undefined : 'standalone',
  poweredByHeader: false,
}

export default nextConfig
