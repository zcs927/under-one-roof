import type { NextConfig } from "next";
const config: NextConfig = {
  devIndicators: false,
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  ...(process.env.EXPORT_STATIC === "1"
    ? {
        output: "export" as const,
        trailingSlash: true,
      }
    : {}),
};
export default config;
