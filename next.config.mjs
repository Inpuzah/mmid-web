/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['googleapis'],
  eslint: { ignoreDuringBuilds: true }, // <-- add this line
};

export default nextConfig;
