import type { Plot } from "../src/lib/constants";

// Village IDs match MapZones.ts, so the local table and map use the same records.
// Sold plots are hidden in the table and disabled on the map.
export const mockPlots: Plot[] = [
  { id: "1-01", settlement: "Ойнеловские дали", area: "7,56", price: "1500000", status: "Свободен" },
  { id: "1-02", settlement: "Ойнеловские дали", area: "8,12", price: "1800000", status: "Забронирован" },
  { id: "1-03", settlement: "Ойнеловские дали", area: "6,5", price: "1400000", status: "Свободен" },
  { id: "1-04", settlement: "Ойнеловские дали", area: "9", price: "2000000", status: "Продан" },
  { id: "local-2-01", category: "ИЖС", title: "Участок у леса (демо)", photos: [
    { src: "https://u5hills.ru/img/53858747_1920_q70.jpg", alt: "Демонстрационная фотография: вид территории" },
    { src: "https://u5hills.ru/img/53858749_1920_q70.jpg", alt: "Демонстрационная фотография: окрестности" },
    { src: "https://u5hills.ru/img/52753815_1920_q70.jpg", alt: "Демонстрационная фотография: общий вид" },
  ], settlement: "Другие участки", area: "10,25", price: "2500000", status: "Свободен" },
  { id: "local-2-02", category: "Дачка", photos: [], settlement: "Другие участки", area: "12,4", price: "2900000", status: "Забронирован" },
  { id: "local-2-03", category: "Дачка", photos: [
    { src: "https://u5hills.ru/img/53858749_1920_q70.jpg", alt: "Демонстрационная фотография участка" },
  ], settlement: "Другие участки", area: "8,75", price: "2100000", status: "Свободен" },
  { id: "local-2-04", settlement: "Другие участки", area: "11", price: "2700000", status: "Продан" },
];
