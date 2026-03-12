import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",

  experimental: {
    optimizePackageImports: [
      "three",
      "@react-three/fiber",
      "@react-three/drei",
      "tone",
    ],
  },

  webpack: (config, { isServer }) => {
    // GLSL shader imports
    config.module.rules.push({
      test: /\.(glsl|vert|frag)$/,
      type: "asset/source",
    });

    // Tree-shake Three.js — only import what's used
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "three/examples/jsm": "three/examples/jsm",
      };
    }

    return config;
  },
};

export default withBundleAnalyzer(nextConfig);
