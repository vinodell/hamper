import type { Plot } from "../src/lib/constants";

// Local public-site fixtures. Sold plots should be hidden in the public table.
export const mockPlots: Plot[] = [
  { id: "local-1-01", settlement: "Ойнеловские дали", area: "7,56", price: "1500000", status: "Свободен" },
  { id: "local-1-02", settlement: "Ойнеловские дали", area: "8,12", price: "1800000", status: "Забронирован" },
  { id: "local-1-03", settlement: "Ойнеловские дали", area: "6,5", price: "1400000", status: "Свободен" },
  { id: "local-1-04", settlement: "Ойнеловские дали", area: "9", price: "2000000", status: "Продан" },
  { id: "local-2-01", settlement: "Другие участки", area: "10,25", price: "2500000", status: "Свободен" },
  { id: "local-2-02", settlement: "Другие участки", area: "12,4", price: "2900000", status: "Забронирован" },
  { id: "local-2-03", settlement: "Другие участки", area: "8,75", price: "2100000", status: "Свободен" },
  { id: "local-2-04", settlement: "Другие участки", area: "11", price: "2700000", status: "Продан" },
];
