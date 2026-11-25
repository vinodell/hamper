import { parsePlotNumber } from "./plotNumbers";
import type { Plot } from "./constants";

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
      result = parsePlotNumber(left[key]) - parsePlotNumber(right[key]);
      break;
    case "price":
      result =
        parsePlotNumber(left.fullPaymentPrice ?? left.price) -
        parsePlotNumber(right.fullPaymentPrice ?? right.price);
      break;
    case "status":
      result = statusOrder[left.status] - statusOrder[right.status];
      break;
  }
  return result || collator.compare(left.id, right.id);
}
