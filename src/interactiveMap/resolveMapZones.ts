import type { Plot, PlotStatus } from "../lib/constants";
import { normalizePlotNumber } from "../lib/plotNumbers";
import type { MapZone, ZoneStatus } from "./Interactive.types";
import { mapZones } from "./MapZones";

const statuses: Record<PlotStatus, ZoneStatus> = {
  Свободен: "available",
  Забронирован: "reserved",
  Продан: "sold",
};

const numericValue = (value: string | undefined) => {
  if (!value) return undefined;
  const number = Number(normalizePlotNumber(value));
  return Number.isFinite(number) && number > 0 ? number : undefined;
};

export const isSelectableZone = (zone: MapZone) =>
  zone.status === "available" || zone.status === "reserved";

export function resolveMapZones(plots: Plot[]): MapZone[] {
  const byId = new Map(
    plots
      .filter((plot) => plot.settlement === "Ойнеловские дали")
      .map((plot) => [plot.id, plot]),
  );

  return mapZones.map((zone) => {
    const plot = byId.get(zone.plotId);
    return {
      ...zone,
      status: plot ? statuses[plot.status] ?? "unknown" : "unknown",
      area: numericValue(plot?.area),
      price: numericValue(plot?.price),
      description: plot?.description ?? undefined,
    };
  });
}
