import type { LucideIcon } from "lucide-react";
import {
  Car,
  CarFront,
  Droplets,
  Factory,
  Fence,
  House,
  Map,
  MapPinned,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TreePine,
  Users,
  Zap,
} from "lucide-react";

const env = import.meta.env;

export const apiUrl = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
export const ADMIN_SAVE_FEEDBACK_MS = 1800;

export const siteConfig = {
  brand: "Hamper",
  brandSubtitle: "мини-поселки",
  phone: env.VITE_PHONE_MAKS,
  phone2: env.VITE_PHONE_VLAD,
  phoneHref: env.VITE_PHONE_HREF,
  vladWhatsapp: env.VITE_WHATSAPP_VLAD,
  maksWhatsapp: env.VITE_WHATSAPP_MAKS,
  vladTelegram: env.VITE_TELEGRAM_VLAD,
  maksTelegram: env.VITE_TELEGRAM_MAKS,
  hours: "ежедневно с 10 до 20",
  email: env.VITE_CONTACT_EMAIL,
  ticker: "Осенние скидки до 10%!",
  copyright: "© 2026 Hamper",
} as const;

export const navigation = [
  ["Проекты", "#projects"],
  ["Контакты", "#form"],
  ["Акции", "#form"],
] as const;

export const projectRoutes = [
  { label: "Ойнеловские дали", path: "/projects/oynelovskie-dali" },
  { label: "Другие участки", path: "/projects/drugie-uchastki" },
] as const;

export const plotStatuses = ["Свободен", "Забронирован", "Продан"] as const;
export type PlotStatus = (typeof plotStatuses)[number];

export interface Plot {
  id: string;
  settlement: string;
  area: string;
  status: PlotStatus;
  price: string;
}

export interface InfoItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

interface IconFact {
  icon: LucideIcon;
  text: string;
}

export interface SettlementFormat {
  label: string;
  title: string;
  copy: string;
  image: string;
  facts: IconFact[];
}

export interface TableSectionProps {
  initialFilter?: Exclude<PlotFilter, "Все">;
  onSelectPlot?: (plot: Plot) => void;
}

export const heroFacts: IconFact[] = [
  { icon: MapPinned, text: "21 участок" },
  { icon: CarFront, text: "25 км от КАД" },
  { icon: Fence, text: "уютная территория" },
  { icon: TreePine, text: "общие зоны отдыха" },
];

export const settlementFormats: SettlementFormat[] = [
  {
    label: "КАМЕРНЫЙ ФОРМАТ",
    title: "Ойнеловские дали",
    copy: "Приватная территория для тех, кто ценит тишину и узкий круг соседей.",
    image: "https://u5hills.ru/img/53858747_1920_q70.jpg",
    facts: [
      { text: "21 участок", icon: Users },
      { text: "Электричество", icon: Zap },
      { text: "Детская площадка", icon: TreePine },
      { text: "Гостевая парковка", icon: Car },
    ],
  },
  {
    label: "РАСШИРЕННАЯ ИНФРАСТРУКТУРА",
    title: "Другие участки",
    copy: "Оптимальный выбор с большим разнообразием участков и расширенными зонами отдыха.",
    image: "https://u5hills.ru/img/53858749_1920_q70.jpg",
    facts: [
      { text: "54 участка", icon: House },
      { text: "Закрытая территория", icon: Fence },
      { text: "Прогулочные зоны", icon: TreePine },
    ],
  },
];

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

export const masterplans = [
  {
    label: "Ойнеловские дали",
    image: "https://u5hills.ru/img/52556357_1920_q70.webp",
  },
  {
    label: "Другие участки",
    image: "https://u5hills.ru/img/52556327_1920_q70.jpg",
  },
] as const;

export const plotFilters = [
  "Все",
  "Ойнеловские дали",
  "Другие участки",
] as const;
export type PlotFilter = (typeof plotFilters)[number];

export type ProjectSlug = "oynelovskie-dali" | "drugie-uchastki";

export const projectPageConfig: Record<
  ProjectSlug,
  { title: string; formatIndex: 0 | 1; plotFilter: Exclude<PlotFilter, "Все"> }
> = {
  "oynelovskie-dali": {
    title: "Ойнеловские дали",
    formatIndex: 0,
    plotFilter: "Ойнеловские дали",
  },
  "drugie-uchastki": {
    title: "Другие участки",
    formatIndex: 1,
    plotFilter: "Другие участки",
  },
};

export const offertaMsg =
  "Предложение не является публичной офертой согласно п.1 ст. 437 ГК РФ";
export const closeMenuMsg = "Закрыть меню";
export const openMenuMsg = "Открыть меню";
export const chooseZemli = "Выбрать участок";
export const policyMsg =
  "Нажимая на кнопку, вы соглашаетесь с политикой конфиденциальности";

export const PHONE_PATTERN = /\+7 \(\d{3}\) \d{3}-\d{2}-\d{2}/.source;

export const PLOTS_REFRESH_MS = 30_000;
