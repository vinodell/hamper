import { useState } from "react";
import { ArrowUpRight, BadgePercent, Pause, Play } from "lucide-react";

import { useSiteSettings } from "../hooks/useSiteSettings";

import "./PromotionBanner.css";

type PromotionBannerProps = { variant?: "ribbon" | "card" };

export function PromotionBanner({ variant = "ribbon" }: PromotionBannerProps) {
  const { settings } = useSiteSettings();
  const [paused, setPaused] = useState(false);

  if (!settings?.promotion.enabled) return null;

  const text = `Скидки до ${settings.promotion.discountPercent}% на участки`;

  if (variant === "card") {
    return (
      <aside className="promotion-card" aria-label={`Акция: ${text}`}>
        <div className="promotion-card__copy tw:flex tw:items-center tw:gap-4">
          <span className="promotion-card__icon" aria-hidden="true">
            <BadgePercent size="1.5rem" />
          </span>
          <div>
            <strong>{text}</strong>
            <p>Уточните условия для выбранного участка.</p>
          </div>
        </div>
        <a
          className="promotion-card__link tw:motion-safe:transition tw:motion-safe:duration-200"
          href="#form"
        >
          Забронировать <ArrowUpRight size="1rem" aria-hidden="true" />
        </a>
      </aside>
    );
  }

  return (
    <div
      className="promotion-ribbon"
      role="region"
      aria-label={`Акция: ${text}`}
      data-paused={paused}
    >
      <div className="promotion-ribbon__track" aria-hidden="true">
        {Array.from({ length: 16 }, (_, index) => (
          <span className="promotion-ribbon__item" key={index}>
            <span>{text}</span>
            <span className="promotion-ribbon__dot">✦</span>
          </span>
        ))}
      </div>
      <button
        className="promotion-ribbon__pause tw:motion-safe:transition tw:motion-safe:duration-200"
        type="button"
        aria-label={
          paused ? "Продолжить движение ленты" : "Приостановить движение ленты"
        }
        aria-pressed={paused}
        onClick={() => setPaused((value) => !value)}
      >
        {paused ? (
          <Play size="1rem" aria-hidden="true" />
        ) : (
          <Pause size="1rem" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
