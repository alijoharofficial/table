import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/table",
  assetPrefix: "/table/",
  images: { unoptimized: true },
  trailingSlash: true,
};

export default nextConfig;
