import type { Plot, PlotStatus } from "../lib/constants";
import type { MapZone, ZoneStatus } from "./Interactive.types";
import { mapZones } from "./MapZones";

const statuses: Record<PlotStatus, ZoneStatus> = {
  Свободен: "available",
  Забронирован: "reserved",
  Продан: "sold",
};

export const isSelectableZone = (zone: MapZone) =>
  zone.status === "available" || zone.status === "reserved";

export function resolveMapZones(plots: Plot[]): MapZone[] {
  const byId = new Map(
    plots
      .filter((plot) => plot.settlement === "Ойнеловские дали")
      .map((plot) => [plot.id, plot]),
  );

  return mapZones.map((zone): MapZone => {
    const plot = byId.get(zone.plotId);
    if (!plot) return { ...zone, status: "unknown" };
    return {
      ...zone,
      status: statuses[plot.status],
      area: Number(plot.area.replace(",", ".")),
      price: Number(plot.price.replace(",", ".")),
      description: plot.description ?? undefined,
    };
  });
}
