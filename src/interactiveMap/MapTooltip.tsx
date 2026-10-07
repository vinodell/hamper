import { useEffect, useState } from "react";
import type { MapTooltipProps } from "./Interactive.types";
import { formatZonePrice, zoneStatusLabels } from "./zonePresentation";

import styles from "./MapTooltip.module.css";

export const getTooltipPosition = (x: number, y: number) => ({
  x: Math.max(16, Math.min(x, window.innerWidth - 296)),
  y: Math.max(16, Math.min(y, window.innerHeight - 180)),
});

export function MapTooltip({ zone, position }: MapTooltipProps) {
  const [pointerPosition, setPointerPosition] = useState(position);

  useEffect(() => {
    let frame = 0;
    let nextPosition = position;
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      nextPosition = getTooltipPosition(event.clientX + 16, event.clientY + 16);
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setPointerPosition(nextPosition);
      });
    };

    // Moving the tooltip should not render all of the map's SVG paths.
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(frame);
    };
  }, [position]);

  return (
    <div
      className={styles.tooltip}
      style={{
        left: pointerPosition.x,
        top: pointerPosition.y,
      }}
      role="tooltip"
    >
      <div className={styles.tooltipHeader}>
        <strong className={styles.tooltipTitle}>{zone.title}</strong>

        <span className={styles.status} data-status={zone.status}>
          {zoneStatusLabels[zone.status]}
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

          <strong>{formatZonePrice(zone.price)}</strong>
        </div>
      )}

      <span className={styles.tooltipHint}>
        Нажмите, чтобы посмотреть подробнее
      </span>
    </div>
  );
}
