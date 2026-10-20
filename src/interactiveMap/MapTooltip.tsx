import { useLayoutEffect, useRef } from "react";
import type { MapTooltipProps } from "./Interactive.types";
import { zoneStatusLabels } from "./zonePresentation";
import { PlotPrice } from "../components/PlotPrice";

import styles from "./MapTooltip.module.css";

export function MapTooltip({ id, zone, position }: MapTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = tooltipRef.current;
    if (!element) return;
    let frame = 0;
    let nextPosition = position;
    const placeTooltip = () => {
      frame = 0;
      const rootSize = Number.parseFloat(
        getComputedStyle(document.documentElement).fontSize,
      );
      const left = Math.max(
        rootSize,
        Math.min(
          nextPosition.x + rootSize,
          window.innerWidth - element.offsetWidth - rootSize,
        ),
      );
      const top = Math.max(
        rootSize,
        Math.min(
          nextPosition.y + rootSize,
          window.innerHeight - element.offsetHeight - rootSize,
        ),
      );
      element.style.left = `${left / rootSize}rem`;
      element.style.top = `${top / rootSize}rem`;
    };
    const schedulePosition = () => {
      if (!frame) frame = requestAnimationFrame(placeTooltip);
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      nextPosition = { x: event.clientX, y: event.clientY };
      schedulePosition();
    };

    // Update only the tooltip position, once per frame, without React renders.
    placeTooltip();
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("resize", schedulePosition);
    const observer = new ResizeObserver(schedulePosition);
    observer.observe(element);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", schedulePosition);
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [position]);

  return (
    <div id={id} ref={tooltipRef} className={styles.tooltip} role="tooltip">
      {/* The parcel's accessible name already includes these details. */}
      <div className={styles.tooltipHeader} aria-hidden="true">
        <strong className={styles.tooltipTitle}>{zone.title}</strong>

        <span className={styles.status} data-status={zone.status}>
          {zoneStatusLabels[zone.status]}
        </span>
      </div>

      {zone.area !== undefined && (
        <div className={styles.tooltipRow} aria-hidden="true">
          <span>Площадь</span>

          <strong>{zone.area.toLocaleString("ru-RU")} сот.</strong>
        </div>
      )}

      {zone.price !== undefined && (
        <div className={styles.tooltipRow} aria-hidden="true">
          <span>Стоимость</span>

          <PlotPrice
            price={zone.price}
            fullPaymentPrice={zone.fullPaymentPrice}
          />
        </div>
      )}

      <span className={styles.tooltipHint}>
        Нажмите, чтобы посмотреть подробнее
      </span>
    </div>
  );
}
