import type { Plot } from "./constants";

interface PlotSummary {
  minimumArea: number | null;
  maximumArea: number | null;
  minimumAvailablePrice: number | null;
  cheapestAvailablePlot: Plot | null;
}

/** Reads validated plots in their existing order; equal prices keep the first. */
export function summarizePlots(
  plots: readonly Plot[],
  priceSource: "base" | "full-payment" = "base",
): PlotSummary {
  const summary: PlotSummary = {
    minimumArea: null,
    maximumArea: null,
    minimumAvailablePrice: null,
    cheapestAvailablePlot: null,
  };

  for (const plot of plots) {
    const area = Number(plot.area.replace(",", "."));
    summary.minimumArea = Math.min(summary.minimumArea ?? area, area);
    summary.maximumArea = Math.max(summary.maximumArea ?? area, area);
    if (plot.status !== "Свободен") continue;

    const priceText =
      priceSource === "full-payment"
        ? (plot.fullPaymentPrice ?? plot.price)
        : plot.price;
    const price = Number(priceText.replace(",", "."));
    if (
      summary.minimumAvailablePrice === null ||
      price < summary.minimumAvailablePrice
    ) {
      summary.minimumAvailablePrice = price;
      summary.cheapestAvailablePlot = plot;
    }
  }
  return summary;
}
