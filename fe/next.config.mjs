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
        destination: `${process.env.BACKEND_URL || "http://localhost:8080"}/api/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:8080"}/uploads/:path*`,
      },
    ]
  },
}

export default nextConfig


