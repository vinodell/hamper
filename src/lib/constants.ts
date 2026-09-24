import type { LucideIcon } from "lucide-react";
import {
  Car,
  CarFront,
  Droplets,
  Factory,
  Fence,
  House,
  Leaf,
  Map,
  MapPinned,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TreePine,
  Users,
  Zap,
} from "lucide-react";

export const phoneNumbers = {
    Vlad: "+7 (911) 920-82-96",
    Maks: "+7 (911) 920-83-42"
}

export const siteConfig = {
  brand: "Hamper",
  brandSubtitle: "мини-поселки",
  phone: phoneNumbers.Maks,
  phone2: phoneNumbers.Vlad,
  phoneHref: "tel:+79119208342",
  hours: "ежедневно с 10 до 20",
  email: "vost.vision@gmail.com",
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

export type PlotStatus = 'Свободен' | 'Забронирован' | 'Продан';

export interface Plot {
  id: string;
  settlement: string;
  area: string;
  status: PlotStatus;
  price: string;
}

export interface Feature {
  title: string;
  text: string;
  icon: string;
}

export interface InfoItem {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface HeroFact {
  icon: LucideIcon;
  text: string;
}

export interface FormatFact {
  text: string;
  icon: LucideIcon;
}

export interface SettlementFormat {
  label: string;
  title: string;
  copy: string;
  image: string;
  facts: FormatFact[];
}

export interface TableSectionProps {
  initialFilter?: Exclude<PlotFilter, "Все">;
}

export const heroFacts: HeroFact[] = [
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

export const advantages: InfoItem[] = [
  {
    icon: Car,
    title: "Транспортная доступность",
    text: "30 минут от пр. Просвещения и Парнаса через Новоприозерское шоссе.",
  },
  {
    icon: Droplets,
    title: "Близость к озёрам",
    text: "15 минут езды до чистых лесных озёр для купания и рыбалки.",
  },
  {
    icon: Leaf,
    title: "Хвойный лес",
    text: "Посёлки окружены вековым хвойным лесом с чистейшим воздухом.",
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
    text: "Рядом «Охта Парк», базы отдыха, конно-спортивные клубы и веломаршруты. [update description]",
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

export const constructionNews = [
  {
    date: "АВГУСТ 2026",
    title: "Дороги и водоотведение внутри поселков",
    text: "Дороги отсыпаны асфальтовой крошкой. Выполняются работы по устройству водоотведения.",
  },
  {
    date: "ИЮНЬ 2026",
    title: "Начали строить дороги",
    text: "Ведутся работы по устройству дорожного полотна внутри посёлков.",
  },
] as const;

export const plots: Plot[] = [
  {
    id: "1-01",
    settlement: "Ойнеловские дали",
    area: "7.00 сот.",
    status: "Забронирован",
    price: "1 500 000 ₽",
  },
  {
    id: "1-02",
    settlement: "Ойнеловские дали",
    area: "6.99 сот.",
    status: "Продан",
    price: "1 500 000 ₽",
  },
  {
    id: "1-03",
    settlement: "Ойнеловские дали",
    area: "6.77 сот.",
    status: "Свободен",
    price: "1 450 000 ₽",
  },
  {
    id: "1-04",
    settlement: "Ойнеловские дали",
    area: "6.50 сот.",
    status: "Свободен",
    price: "1 400 000 ₽",
  },
  {
    id: "1-05",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-06",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-07",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-08",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-09",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-10",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-11",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-12",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-13",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-14",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-15",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-16",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-17",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-18",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-19",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
  {
    id: "1-20",
    settlement: "Ойнеловские дали",
    area: "7.40 сот.",
    status: "Свободен",
    price: "1 650 000 ₽",
  },
  {
    id: "1-21",
    settlement: "Ойнеловские дали",
    area: "8.12 сот.",
    status: "Свободен",
    price: "1 800 000 ₽",
  },
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
