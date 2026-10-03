import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.CAMPUS_UI_VERIFY === "preview" || process.env.CAMPUS_UI_VERIFY === "build" || process.env.CAMPUS_UI_VERIFY === "assistant-build"
    ? {
        distDir: process.env.CAMPUS_UI_VERIFY === "preview"
          ? "artifacts/student-ux-20260930/preview/.next"
          : process.env.CAMPUS_UI_VERIFY === "assistant-build"
            ? "artifacts/assistant-workspace-20261001/build-final/.next"
            : "artifacts/student-ux-20260930/build-verified/.next",
        typescript: { tsconfigPath: "artifacts/student-ux-20260930/tsconfig.json" },
      }
    : {}),
  poweredByHeader: false,
  // Allow the documented local URL to load Next.js development assets.
  allowedDevOrigins: ["127.0.0.1"],
  async redirects() {
    return [{ source: "/chat", destination: "/student", permanent: false }];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          }
          // HSTS (Strict-Transport-Security) is removed here. It is a platform/deployment gate
          // and should only be enabled when production HTTPS and subdomains are fully verified.
        ],
      },
    ];
  },
};

export default nextConfig;
