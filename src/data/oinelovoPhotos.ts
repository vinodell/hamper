import type { PlotPhoto } from "./individualPlots";

export const oinelovoPhotos = [
  {
    file: "dji_0696",
    alt: "Территория Ойнеловских далей и центральный проезд с высоты",
  },
  {
    file: "dji_0699",
    alt: "Участки посёлка и соседняя застройка у леса",
  },
  {
    file: "dji_0705",
    alt: "Общий вид участков и подъездных дорог",
  },
  {
    file: "dji_0706",
    alt: "Территория посёлка со стороны подъездной дороги",
  },
  {
    file: "dji_0712",
    alt: "Центральный проезд и участки Ойнеловских далей",
  },
].map(({ file, alt }) => ({
  src: `images/oinelovo/${file}-1280.webp`,
  preview: `images/oinelovo/${file}-640.webp`,
  alt,
})) satisfies (PlotPhoto & { preview: string })[];
