export type ZoneStatus = "available" | "reserved" | "sold" | "unknown";

export type MapZone = {
  id: string;
  number: number;
  title: string;

  /**
   * SVG path data.
   */
  d: string;
  status: ZoneStatus;

  /**
   * Optional business data.
   * Заполни их реальными значениями, когда они будут.
   */
  area?: number;
  price?: number;
  description?: string;
};

export type PointerPosition = {
  x: number;
  y: number;
};

export type InteractiveMapProps = {
  /**
   * URL изображения, поверх которого рисуется SVG-сетка.
   *
   * Например:
   * /images/master-plan.webp
   */
  imageSrc: string;

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
