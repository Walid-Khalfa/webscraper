import bundleAnalyzer from "@next/bundle-analyzer";
import { validateStartupEnvironment } from "./app/api/_lib/env.js";

validateStartupEnvironment();

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default withBundleAnalyzer(nextConfig);
