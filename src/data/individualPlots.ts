export type PlotCategory = "ИЖС" | "Дачка";

export interface PlotPhoto {
  src: string;
  alt: string;
}

export interface IndividualPlotDetails {
  title?: string;
  category?: PlotCategory;
  photos: PlotPhoto[];
}

/**
 * Metadata for individual plots, keyed by their exact ID from the admin panel.
 * Photos in public/ should use paths relative to the site base, e.g.
 * "images/plots/2-01/01.webp". Absolute https URLs are also supported.
 * No category or photographs are assumed when a plot has no entry here.
 */
export const individualPlots: Record<string, IndividualPlotDetails> = {};
