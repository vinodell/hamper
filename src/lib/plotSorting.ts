import type { Plot } from "./constants";
import { normalizePlotNumber } from "./plotNumbers";

export type PlotSortKey = "id" | "category" | "area" | "status" | "price";

const collator = new Intl.Collator("ru", {
  numeric: true,
  sensitivity: "base",
});
const statusOrder: Record<Plot["status"], number> = {
  Свободен: 0,
  Забронирован: 1,
  Продан: 2,
};

function numericValue(value: string): number {
  const number = Number(normalizePlotNumber(value));
  return Number.isFinite(number) ? number : 0;
}

/** Keep exact IDs intact: 2-2 precedes 2-10, including IDs with text prefixes. */
export function comparePlots(
  left: Plot,
  right: Plot,
  key: PlotSortKey,
): number {
  let result = 0;
  switch (key) {
    case "category":
      result = collator.compare(
        left.category ?? "Уточняется",
        right.category ?? "Уточняется",
      );
      break;
    case "area":
    case "price":
      result = numericValue(left[key]) - numericValue(right[key]);
      break;
    case "status":
      result = statusOrder[left.status] - statusOrder[right.status];
      break;
  }
  return result || collator.compare(left.id, right.id);
}
