/** @type {import('next').NextConfig} */
const nextConfig = {
  // correct key for Next 15
  serverExternalPackages: ['googleapis'],

  // optional: bypass ESLint during builds while you iterate
  // eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
