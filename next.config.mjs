/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Phase 0: keep the skeleton deploying even before lint config is fully tuned.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
