/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  devIndicators: {
    buildActivity: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080"}/api/:path*`,
      },
      {
        source: "/ai-api/:path*",
        destination: `${process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:8000"}/api/:path*`,
      },
    ]
  },
}

export default nextConfig


