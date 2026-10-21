import type { SiteSettings } from "../src/lib/siteSettings";

/** Public demo only; independent of saved admin settings. */
export const mockSettings: SiteSettings = {
  promotion: { enabled: true, discountPercent: 12 },
};
