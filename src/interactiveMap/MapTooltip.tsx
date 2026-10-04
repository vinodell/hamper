import type { MapTooltipProps } from "./Interactive.types";

import styles from "./MapTooltip.module.css";

const formatPrice = (price: number): string =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);

const getStatusLabel = (status: MapTooltipProps["zone"]["status"]): string => {
  switch (status) {
    case "available":
      return "Свободен";
    case "reserved":
      return "Забронирован";
    case "sold":
      return "Продан";
    case "unknown":
    default:
      return "Статус уточняется";
  }
};

export function MapTooltip({ zone, position }: MapTooltipProps) {
  return (
    <div
      className={styles.tooltip}
      style={{
        left: position.x,
        top: position.y,
      }}
      role="tooltip"
    >
      <div className={styles.tooltipHeader}>
        <strong className={styles.tooltipTitle}>{zone.title}</strong>

        <span className={styles.status} data-status={zone.status}>
          {getStatusLabel(zone.status)}
        </span>
      </div>

      {zone.area !== undefined && (
        <div className={styles.tooltipRow}>
          <span>Площадь</span>

          <strong>{zone.area.toLocaleString("ru-RU")} сот.</strong>
        </div>
      )}

      {zone.price !== undefined && (
        <div className={styles.tooltipRow}>
          <span>Стоимость</span>

          <strong>{formatPrice(zone.price)}</strong>
        </div>
      )}

      <span className={styles.tooltipHint}>
        Нажмите, чтобы посмотреть подробнее
      </span>
    </div>
  );
}
