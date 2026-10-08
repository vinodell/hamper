import { useEffect, useMemo, useState } from "react";
import { MapTooltip } from "./MapTooltip";
import { ZoneModal } from "./ZoneModal";
import { MAP_GROUP_TRANSFORM, MAP_VIEW_BOX } from "./MapZones";
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
  imageSrcSet,
  imageSizes,
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
  const selectableZones = useMemo(
    () =>
      new Map(zones.filter(isSelectableZone).map((zone) => [zone.id, zone])),
    [zones],
  );
  const hoveredZone = hoveredZoneId
    ? selectableZones.get(hoveredZoneId)
    : undefined;
  const selectedZone = selectedZoneId
    ? selectableZones.get(selectedZoneId)
    : undefined;

  useEffect(() => setImageFailed(false), [imageSrc]);

  useEffect(() => {
    // Close a sold/deleted parcel immediately; don't reopen it on a later update.
    if (selectedZoneId && !selectedZone) setSelectedZoneId(null);
    if (hoveredZoneId && !hoveredZone) setHoveredZoneId(null);
  }, [selectedZoneId, selectedZone, hoveredZoneId, hoveredZone]);

  const handleZoneClick = (zone: MapZone) => {
    setSelectedZoneId(zone.id);
    setHoveredZoneId(null);
    onZoneClick?.(zone);
  };

  return (
    <>
      <div className={[styles.map, className].filter(Boolean).join(" ")}>
        <img
          className={styles.render}
          src={imageSrc}
          srcSet={imageSrcSet}
          sizes={imageSizes}
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
                      setPointerPosition({
                        x: event.clientX,
                        y: event.clientY,
                      });
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
                      setPointerPosition({ x: bounds.right, y: bounds.top });
                      setHoveredZoneId(zone.id);
                    }}
                    onBlur={() => {
                      setHoveredZoneId(null);
                    }}
                    onClick={
                      selectable ? () => handleZoneClick(zone) : undefined
                    }
                    onKeyDown={
                      selectable
                        ? (event) => {
                            if (event.key !== "Enter" && event.key !== " ")
                              return;
                            event.preventDefault();
                            handleZoneClick(zone);
                          }
                        : undefined
                    }
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
          <MapTooltip
            key={hoveredZone.id}
            zone={hoveredZone}
            position={pointerPosition}
          />
        )}
      </div>

      {selectedZone && (
        <ZoneModal
          zone={selectedZone}
          onClose={() => setSelectedZoneId(null)}
        />
      )}
    </>
  );
};
