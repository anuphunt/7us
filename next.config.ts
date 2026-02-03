import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Allow dev access from other devices on the LAN.
  // Next.js will otherwise warn (and may block in future versions).
  allowedDevOrigins: [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://10.0.0.115:3000',
    'http://anup-macbook-pro.local:3000',
  ],
}

export default nextConfig
