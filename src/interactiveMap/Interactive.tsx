import { useMemo, useState, KeyboardEvent, PointerEvent } from "react";
import {
  MapTooltip,
  ZoneModal,
  MAP_GROUP_TRANSFORM,
  MAP_VIEW_BOX,
  mapZones,
} from "./";

import type {
  InteractiveMapProps,
  MapZone,
  PointerPosition,
} from "./Interactive.types";

import styles from "./Interactive.module.css";

const INITIAL_POINTER_POSITION: PointerPosition = {
  x: 0,
  y: 0,
};

export const InteractiveMap = ({
  imageSrc,
  imageAlt = "Карта участков",
  onZoneClick,
  className,
}: InteractiveMapProps) => {
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<MapZone | null>(null);
  const [pointerPosition, setPointerPosition] = useState<PointerPosition>(
    INITIAL_POINTER_POSITION,
  );

  const hoveredZone = useMemo(
    () => mapZones.find((zone) => zone.id === hoveredZoneId) ?? null,
    [hoveredZoneId],
  );

  const handleZoneClick = (zone: MapZone): void => {
    /**
     * Проданный участок можно оставить
     * кликабельным, чтобы человек видел детали.
     *
     * Поэтому здесь специально нет:
     *
     * if (zone.status === 'sold') return;
     */

    setSelectedZone(zone);
    onZoneClick?.(zone);
  };

  const handleZoneKeyDown = (
    event: KeyboardEvent<SVGPathElement>,
    zone: MapZone,
  ): void => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();

    handleZoneClick(zone);
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>): void => {
    /**
     * На touch tooltip не нужен.
     * Там основной interaction — tap.
     */
    if (event.pointerType === "touch") {
      return;
    }

    setPointerPosition({
      x: event.clientX + 16,
      y: event.clientY + 16,
    });
  };

  return (
    <>
      <div className={[styles.map, className].filter(Boolean).join(" ")}>
        <svg
          className={styles.svg}
          viewBox={MAP_VIEW_BOX}
          role="img"
          aria-label={imageAlt}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {
            setHoveredZoneId(null);
          }}
        >
          <image
            href={imageSrc}
            x="0"
            y="0"
            width="674.05331"
            height="1027.2666"
            /**
             * Критично для совпадения
             * координат изображения и SVG.
             *
             * Если исходное изображение имеет
             * ровно тот же aspect ratio,
             * можно заменить на:
             *
             * xMidYMid meet
             */
            preserveAspectRatio="none"
          />

          <g transform={MAP_GROUP_TRANSFORM}>
            {mapZones.map((zone) => {
              const isHovered = hoveredZoneId === zone.id;

              const isSelected = selectedZone?.id === zone.id;

              return (
                <path
                  key={zone.id}
                  d={zone.d}
                  className={styles.zone}
                  data-status={zone.status}
                  data-hovered={isHovered}
                  data-selected={isSelected}
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  role="button"
                  aria-label={`${zone.title}. Нажмите, чтобы посмотреть подробнее`}
                  aria-haspopup="dialog"
                  onPointerEnter={(event) => {
                    /**
                     * На touch нет настоящего hover.
                     */
                    if (event.pointerType === "touch") {
                      return;
                    }

                    setHoveredZoneId(zone.id);
                  }}
                  onPointerLeave={() => {
                    setHoveredZoneId(null);
                  }}
                  onFocus={() => {
                    setHoveredZoneId(zone.id);
                  }}
                  onBlur={() => {
                    setHoveredZoneId(null);
                  }}
                  onClick={() => {
                    handleZoneClick(zone);
                  }}
                  onKeyDown={(event) => {
                    handleZoneKeyDown(event, zone);
                  }}
                />
              );
            })}
          </g>
        </svg>

        {hoveredZone && (
          <MapTooltip zone={hoveredZone} position={pointerPosition} />
        )}
      </div>

      {selectedZone && (
        <ZoneModal
          zone={selectedZone}
          onClose={() => {
            setSelectedZone(null);
          }}
        />
      )}
    </>
  );
};
