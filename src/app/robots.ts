import type { MetadataRoute } from "next";

/**
 * 全站禁止收录。
 *
 * 这是给守规矩的爬虫看的声明 —— 硬约束在 next.config.mjs 的 X-Robots-Tag
 * 和 layout 的 metadata.robots 上，三处都设置是为了不依赖任何单一机制。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        disallow: "/",
      },
    ],
  };
}
