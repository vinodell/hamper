import type { SiteSettings } from "./siteSettings";

/** Keep the raw input and its server baseline through authentication changes. */
export interface PromotionDraft {
  saved: SiteSettings | null;
  enabled: boolean;
  discount: string;
}

export function createPromotionDraft(
  saved: SiteSettings | null = null,
): PromotionDraft {
  return {
    saved,
    enabled: saved?.promotion.enabled ?? false,
    discount: String(saved?.promotion.discountPercent ?? 10),
  };
}

export function mergePromotionDraft(
  loaded: SiteSettings,
  current: PromotionDraft,
): PromotionDraft {
  const previous = current.saved?.promotion;
  return {
    saved: loaded,
    enabled:
      previous && current.enabled !== previous.enabled
        ? current.enabled
        : loaded.promotion.enabled,
    discount:
      previous && current.discount !== String(previous.discountPercent)
        ? current.discount
        : String(loaded.promotion.discountPercent),
  };
}
