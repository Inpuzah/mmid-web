/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // lets Next bundle certain Node-only deps for server routes
    serverComponentsExternalPackages: ['googleapis'],
  },
};

export default nextConfig;
