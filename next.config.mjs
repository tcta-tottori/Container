/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: process.env.NODE_ENV === "production" ? "/Container" : "",
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BUILD_TIME: new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '.'),
  },
};

export default nextConfig;
