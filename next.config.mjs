// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['googleapis'], // <-- new key name
  // If you want to keep linting, delete the next 3 lines.
  // They just bypass ESLint during Vercel builds.
  // eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
