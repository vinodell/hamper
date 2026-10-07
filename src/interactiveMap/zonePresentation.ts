import type { ZoneStatus } from "./Interactive.types";

const priceFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

export const formatZonePrice = (price: number) => priceFormatter.format(price);

export const zoneStatusLabels: Record<ZoneStatus, string> = {
  available: "Свободен",
  reserved: "Забронирован",
  sold: "Продан",
  unknown: "Статус уточняется",
};
