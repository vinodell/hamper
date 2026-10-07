import type { Plot } from "../lib/constants";

export type ZoneStatus = "available" | "reserved" | "sold" | "unknown";

export type MapZoneLayout = {
  id: string;
  /** Exact ID in /api/plots and the admin table, e.g. 1-01. */
  plotId: string;
  number: number;
  title: string;

  /**
   * SVG path data.
   */
  d: string;
  labelPosition: { x: number; y: number };
};

export type MapZone = MapZoneLayout & {
  status: ZoneStatus;
  area?: number;
  price?: number;
  description?: string;
};

export type PointerPosition = {
  x: number;
  y: number;
};

export type InteractiveMapProps = {
  plots: Plot[];
  /**
   * URL изображения, поверх которого рисуется SVG-сетка.
   *
   * Например:
   * /images/master-plan.webp
   */
  imageSrc: string;
  imageSrcSet?: string;
  imageSizes?: string;

  /**
   * Accessible description изображения.
   */
  imageAlt?: string;

  /**
   * Вызывается при клике на участок.
   * Можно использовать дополнительно к встроенной modal.
   */
  onZoneClick?: (zone: MapZone) => void;

  className?: string;
};

export type MapTooltipProps = {
  zone: MapZone;
  position: PointerPosition;
};

export type ZoneModalProps = {
  zone: MapZone;
  onClose: () => void;
};
