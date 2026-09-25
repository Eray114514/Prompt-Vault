/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === "production";

/**
 * 之前这里是个空配置，线上实测除了 HSTS 什么安全头都没有。
 * 下面这些全是零成本的边缘响应头，不占用运行时。
 */
const securityHeaders = [
  // 禁止搜索引擎收录。robots.txt 是君子协定，这个头才是硬约束。
  {
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive, nosnippet, noimageindex",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), clipboard-read=(self)",
  },
];

// CSP 只在生产环境下发：next dev 的 HMR 依赖 eval 和 websocket，套上会直接起不来。
if (isProd) {
  securityHeaders.push({
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // 胶片颗粒纹理是内联 data: 图片，样式与 Tailwind 运行时需要 inline
      "img-src 'self' data: blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      "font-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  });
}

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
