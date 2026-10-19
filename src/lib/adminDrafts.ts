import type { AdminPlot, PlotUpdate } from "./api";
import { normalizePlotNumber } from "./plotNumbers";

export const toPlotUpdate = (plot: AdminPlot): PlotUpdate => ({
  area: normalizePlotNumber(plot.area),
  status: plot.status,
  price: normalizePlotNumber(plot.price),
  street: plot.street ?? "",
  description: plot.description ?? "",
  cadastralNumber: plot.cadastralNumber?.trim() ?? "",
  gpzuDone: plot.gpzuDone ?? false,
  buildingPermitDone: plot.buildingPermitDone ?? false,
  mortgageUrl: plot.mortgageUrl?.trim() ?? "",
});

export function mergeAdminDrafts(
  loaded: AdminPlot[],
  drafts: AdminPlot[],
  savedById: ReadonlyMap<string, AdminPlot>,
): AdminPlot[] {
  const draftsById = new Map(drafts.map((plot) => [plot.id, plot]));
  return loaded.map((plot) => {
    const draft = draftsById.get(plot.id);
    const saved = savedById.get(plot.id);
    if (!draft || !saved) return plot;
    const before = toPlotUpdate(saved);
    const edited = toPlotUpdate(draft);
    return {
      ...plot,
      area: edited.area !== before.area ? draft.area : plot.area,
      status: edited.status !== before.status ? draft.status : plot.status,
      price: edited.price !== before.price ? draft.price : plot.price,
      street: edited.street !== before.street ? draft.street : plot.street,
      description:
        edited.description !== before.description
          ? draft.description
          : plot.description,
      cadastralNumber:
        edited.cadastralNumber !== before.cadastralNumber
          ? draft.cadastralNumber
          : plot.cadastralNumber,
      gpzuDone:
        edited.gpzuDone !== before.gpzuDone ? draft.gpzuDone : plot.gpzuDone,
      buildingPermitDone:
        edited.buildingPermitDone !== before.buildingPermitDone
          ? draft.buildingPermitDone
          : plot.buildingPermitDone,
      mortgageUrl:
        edited.mortgageUrl !== before.mortgageUrl
          ? draft.mortgageUrl
          : plot.mortgageUrl,
    };
  });
}
