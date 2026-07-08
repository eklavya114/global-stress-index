/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["maplibre-gl", "three", "@react-three/fiber", "@react-three/drei"],
  webpack: (config) => {
    // Allow Three.js to resolve properly
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    return config;
  },
  // R3F needs this to work in Next.js App Router
  experimental: {
    esmExternals: "loose",
  },
};

module.exports = nextConfig;
