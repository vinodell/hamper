import {
  useEffect,
  useMemo,
  useState,
  KeyboardEvent,
  PointerEvent,
} from "react";
import { MapTooltip, ZoneModal, MAP_GROUP_TRANSFORM, MAP_VIEW_BOX } from "./";
import { isSelectableZone, resolveMapZones } from "./resolveMapZones";

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
  plots,
  imageSrc,
  imageAlt = "Карта участков",
  onZoneClick,
  className,
}: InteractiveMapProps) => {
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [pointerPosition, setPointerPosition] = useState<PointerPosition>(
    INITIAL_POINTER_POSITION,
  );

  const zones = useMemo(() => resolveMapZones(plots), [plots]);
  const hoveredZone = zones.find(
    (zone) => zone.id === hoveredZoneId && isSelectableZone(zone),
  );
  const selectedZone = zones.find(
    (zone) => zone.id === selectedZoneId && isSelectableZone(zone),
  );

  useEffect(() => {
    // Close a sold/deleted parcel immediately; don't reopen it on a later update.
    if (selectedZoneId && !selectedZone) setSelectedZoneId(null);
    if (hoveredZoneId && !hoveredZone) setHoveredZoneId(null);
  }, [selectedZoneId, selectedZone, hoveredZoneId, hoveredZone]);

  const handleZoneClick = (zone: MapZone): void => {
    if (!isSelectableZone(zone)) return;
    setSelectedZoneId(zone.id);
    setHoveredZoneId(null);
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
      x: Math.max(16, Math.min(event.clientX + 16, window.innerWidth - 296)),
      y: Math.max(16, Math.min(event.clientY + 16, window.innerHeight - 180)),
    });
  };

  return (
    <>
      <div className={[styles.map, className].filter(Boolean).join(" ")}>
        <img
          className={styles.render}
          src={imageSrc}
          alt=""
          width={1024}
          height={1536}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          hidden={imageFailed}
        />
        {imageFailed && (
          <p className={styles.fallback} role="status">
            Визуализация не загрузилась. Выберите участок на схеме.
          </p>
        )}
        <svg
          className={styles.svg}
          viewBox={MAP_VIEW_BOX}
          role="group"
          aria-label={imageAlt}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {
            setHoveredZoneId(null);
          }}
        >
          <g transform={MAP_GROUP_TRANSFORM}>
            {zones.map((zone) => {
              const selectable = isSelectableZone(zone);
              const isHovered = hoveredZoneId === zone.id;

              const isSelected = selectedZone?.id === zone.id;

              return (
                <g key={zone.id}>
                  <path
                    data-number={zone.number}
                    data-plot-id={zone.plotId}
                    d={zone.d}
                    className={styles.zone}
                    data-status={zone.status}
                    data-selectable={selectable}
                    data-hovered={isHovered}
                    data-selected={isSelected}
                    vectorEffect="non-scaling-stroke"
                    tabIndex={selectable ? 0 : undefined}
                    role={selectable ? "button" : "img"}
                    aria-label={`${zone.title}. ${
                      selectable
                        ? "Нажмите, чтобы посмотреть подробнее"
                        : zone.status === "sold"
                          ? "Продан"
                          : "Статус уточняется"
                    }`}
                    aria-haspopup={selectable ? "dialog" : undefined}
                    onPointerEnter={(event) => {
                      /**
                       * На touch нет настоящего hover.
                       */
                      if (!selectable || event.pointerType === "touch") {
                        return;
                      }

                      setHoveredZoneId(zone.id);
                    }}
                    onPointerLeave={() => {
                      setHoveredZoneId(null);
                    }}
                    onFocus={(event) => {
                      if (
                        !selectable ||
                        !event.currentTarget.matches(":focus-visible")
                      )
                        return;
                      const bounds =
                        event.currentTarget.getBoundingClientRect();
                      setPointerPosition({
                        x: Math.max(
                          16,
                          Math.min(bounds.right + 16, window.innerWidth - 296),
                        ),
                        y: Math.max(
                          16,
                          Math.min(bounds.top, window.innerHeight - 180),
                        ),
                      });
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
                  {selectable && (
                    <g
                      className={styles.marker}
                      transform={`translate(${zone.labelPosition.x},${zone.labelPosition.y})`}
                      aria-hidden="true"
                    >
                      <circle r="18" />
                      <text textAnchor="middle" dy=".35em">
                        {zone.number}
                      </text>
                    </g>
                  )}
                </g>
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
            setSelectedZoneId(null);
          }}
        />
      )}
    </>
  );
};
