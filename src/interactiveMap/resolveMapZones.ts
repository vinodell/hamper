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
  const plotsById = new Map<string, Plot>();
  for (const plot of plots) {
    if (plot.settlement === "Ойнеловские дали") plotsById.set(plot.id, plot);
  }

  return mapZones.map((zone): MapZone => {
    const plot = plotsById.get(zone.plotId);
    if (!plot) return { ...zone, status: "unknown" };
    return {
      ...zone,
      status: statuses[plot.status],
      area: Number(plot.area.replace(",", ".")),
      price: Number(plot.price.replace(",", ".")),
      ...(plot.fullPaymentPrice?.trim()
        ? { fullPaymentPrice: Number(plot.fullPaymentPrice.replace(",", ".")) }
        : {}),
      description: plot.description ?? undefined,
      cadastralNumber: plot.cadastralNumber,
      gpzuDone: plot.gpzuDone,
      buildingPermitDone: plot.buildingPermitDone,
      mortgageUrl: plot.mortgageUrl,
    };
  });
}
