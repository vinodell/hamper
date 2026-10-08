import type { AdminPlot, PlotUpdate } from "./api";
import { normalizePlotNumber } from "./plotNumbers";

export const toPlotUpdate = (plot: AdminPlot): PlotUpdate => ({
  area: normalizePlotNumber(plot.area),
  status: plot.status,
  price: normalizePlotNumber(plot.price),
  street: plot.street ?? "",
  description: plot.description ?? "",
});

/** Restore local edits after re-entry while retaining other server changes. */
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
    };
  });
}
