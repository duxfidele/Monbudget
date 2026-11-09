import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const cspDirectives = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://challenges.cloudflare.com https://js.stripe.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://*.googleusercontent.com https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.moneriz.com https://moneriz.com https://challenges.cloudflare.com",
  "frame-src 'self' blob: data: https://*.supabase.co https://*.moneriz.com https://moneriz.com https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
];

const securityHeaders = [
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
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
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Content-Security-Policy",
    value: `${cspDirectives.join("; ")};`,
  },
];

const nextConfig: NextConfig = {
  allowedDevOrigins: ["100.115.92.26", "localhost", "127.0.0.1"],
  async redirects() {
    return [
      {
        source: "/conditions",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/conditions-generales",
        destination: "/terms",
        permanent: true,
      },
      {
        source: "/confidentialite",
        destination: "/privacy",
        permanent: true,
      },
      {
        source: "/politique-de-confidentialite",
        destination: "/privacy",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
