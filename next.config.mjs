/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8001"}/:path*`
      }
    ];
  }
};

export default nextConfig;
