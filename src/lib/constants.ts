import type { IndividualPlotDetails } from "../data/individualPlots";
import type { LucideIcon } from "lucide-react";
import {
  Droplets,
  Factory,
  Map,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Zap,
} from "lucide-react";

export { projectRoutes } from "./routes";

const env = import.meta.env;

export const apiUrl = import.meta.env.DEV
  ? (import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, "") ?? "")
  : "";

export const siteConfig = {
  brand: "Хампер",
  brandSubtitle: "мини-поселки",
  phone: env.VITE_PHONE_MAKS,
  phone2: env.VITE_PHONE_VLAD,
  phoneHref: env.VITE_PHONE_HREF,
  phone2Href: `tel:${env.VITE_PHONE_VLAD?.replace(/[^\d+]/g, "") ?? ""}`,
  vladWhatsapp: env.VITE_WHATSAPP_VLAD,
  maksWhatsapp: env.VITE_WHATSAPP_MAKS,
  vladTelegram: env.VITE_TELEGRAM_VLAD,
  maksTelegram: env.VITE_TELEGRAM_MAKS,
  hours: "ежедневно с 10 до 20",
  email: env.VITE_CONTACT_EMAIL,
  copyright: "© 2026 Хампер",
} as const;

export const navigation = [
  ["Проекты", "#poselki"],
  ["Контакты", "#form"],
  ["Акции", "#form"],
] as const;

export const homeNavigation = [
  ["Посёлки", "#poselki"],
  ["О компании", "#about-company"],
  ["Контакты", "#form"],
] as const;

export const plotStatuses = ["Свободен", "Забронирован", "Продан"] as const;
export type PlotStatus = (typeof plotStatuses)[number];

export interface Plot {
  category?: IndividualPlotDetails["category"];
  photos?: IndividualPlotDetails["photos"];
  title?: string;
  id: string;
  settlement: string;
  area: string;
  status: PlotStatus;
  price: string;
  fullPaymentPrice?: string | null;
  description?: string | null;
  cadastralNumber?: string | null;
  gpzuDone?: boolean;
  buildingPermitDone?: boolean;
  mortgageUrl?: string | null;
}

export interface InfoItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface TableSectionProps {
  initialFilter?: Exclude<PlotFilter, "Все">;
  onSelectPlot?: (plot: Plot) => void;
  sortable?: boolean;
}

export const infrastructure: InfoItem[] = [
  {
    icon: ShoppingBag,
    title: "Магазины и сервисы",
    text: "В 5–10 мин езды находятся супермаркеты, аптеки и пункты выдачи заказов.",
  },
  {
    icon: Factory,
    title: "Социальная сфера",
    text: "Школы, детские сады и поликлиники расположены в ближайших населённых пунктах.",
  },
  {
    icon: Sparkles,
    title: "Активный отдых",
    text: "Рядом «Охта Парк», базы отдыха, конно-спортивные клубы и веломаршруты.",
  },
];

export const utilities: InfoItem[] = [
  { icon: Zap, title: "Электричество", text: "15 кВт от Ленэнерго" },
  { icon: Droplets, title: "Водоснабжение", text: "Индивидуальные скважины" },
  { icon: ShieldCheck, title: "Прописка", text: "Регистрация с пропиской" },
  { icon: Map, title: "Дороги", text: "Широкие и доступные проезды" },
];

export const plotFilters = [
  "Все",
  "Ойнеловские дали",
  "Другие участки",
] as const;
export type PlotFilter = (typeof plotFilters)[number];

export type ProjectSlug = "oynelovskie-dali" | "drugie-uchastki";

export const projectPageConfig: Record<
  ProjectSlug,
  { title: string; plotFilter: Exclude<PlotFilter, "Все"> }
> = {
  "oynelovskie-dali": {
    title: "Ойнеловские дали",
    plotFilter: "Ойнеловские дали",
  },
  "drugie-uchastki": {
    title: "Другие участки",
    plotFilter: "Другие участки",
  },
};

export const offertaMsg =
  "Предложение не является публичной офертой согласно п.1 ст. 437 ГК РФ";
export const closeMenuMsg = "Закрыть меню";
export const openMenuMsg = "Открыть меню";
export const chooseZemli = "Выбрать участок";
export const PHONE_PATTERN =
  /\s*(?:\+\s*7|7|8)?(?:[\s.\-\(\)]*\d){10}[\s.\-\(\)]*/.source;

export const PLOTS_REFRESH_MS = 30_000;

export interface MapDestination {
  /** Latitude, longitude of the actual entrance, e.g. "60.123456, 30.123456". */
  coordinates: string;
  /** Yandex Navigator route/deep link supplied by the project owner. */
  navigatorUrl: string;
}

// Fill in the entrance location before enabling coordinate copying/navigation.
// Empty values keep the respective action visibly unavailable.
export const oinelovoLocation: MapDestination = {
  coordinates: "60.264162, 30.416167",
  navigatorUrl: "",
};
