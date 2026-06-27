import { appUrl } from "../lib/site-config";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/admin/"],
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
