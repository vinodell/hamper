import type { Plot } from "../src/lib/constants";

/** Fictional scenarios for the local public demo, never production inventory. */
export const mockPlots: Plot[] = [
  {
    id: "1-01",
    settlement: "Ойнеловские дали",
    area: "7,56",
    price: "1500000",
    fullPaymentPrice: "1300000",
    status: "Свободен",
    cadastralNumber: "47:07:0123456:101",
    gpzuDone: true,
    buildingPermitDone: true,
    mortgageUrl: "https://domclick.ru/card/sale__lot__100000001",
    description:
      "Демо: свободный участок со специальной ценой при полной оплате и готовыми документами.",
  },
  {
    id: "1-02",
    settlement: "Ойнеловские дали",
    area: "8,12",
    price: "1800000",
    fullPaymentPrice: "1650000",
    status: "Забронирован",
    cadastralNumber: null,
    gpzuDone: false,
    buildingPermitDone: false,
    mortgageUrl: null,
    description:
      "Демо: забронированный участок. Можно оставить заявку на уведомление, если бронь снимут.",
  },
  {
    id: "1-03",
    settlement: "Ойнеловские дали",
    area: "6,5",
    price: "1400000",
    fullPaymentPrice: null,
    status: "Свободен",
    cadastralNumber: "47:07:0123456:103",
    gpzuDone: true,
    buildingPermitDone: false,
    mortgageUrl: "https://domclick.ru/card/sale__lot__100000003",
    description:
      "Демо: обычная цена без наклейки, ГПЗУ получен, разрешение на строительство не подтверждено.",
  },
  {
    id: "1-04",
    settlement: "Ойнеловские дали",
    area: "9",
    price: "2000000",
    fullPaymentPrice: null,
    status: "Продан",
    cadastralNumber: "47:07:0123456:104",
    gpzuDone: true,
    buildingPermitDone: true,
    mortgageUrl: null,
    description:
      "Демо: проданный участок для проверки цвета карты и недоступности покупки.",
  },
  ...Array.from({ length: 17 }, (_, index): Plot => {
    const number = index + 5;
    return {
      id: `1-${String(number).padStart(2, "0")}`,
      settlement: "Ойнеловские дали",
      area: number % 2 === 0 ? "7,4" : "8,12",
      price: number % 2 === 0 ? "1650000" : "1800000",
      fullPaymentPrice: null,
      status:
        number % 5 === 0
          ? "Забронирован"
          : number % 3 === 0
            ? "Продан"
            : "Свободен",
      cadastralNumber: null,
      gpzuDone: false,
      buildingPermitDone: false,
      mortgageUrl: null,
    };
  }),
  {
    id: "local-2-01",
    settlement: "Другие участки",
    category: "ИЖС",
    title: "Участок у леса (демо)",
    area: "10,25",
    price: "2500000",
    fullPaymentPrice: "2250000",
    status: "Свободен",
    cadastralNumber: "47:07:0123456:201",
    gpzuDone: true,
    buildingPermitDone: false,
    mortgageUrl: "https://domclick.ru/card/sale__lot__100000201",
    photos: [
      {
        src: "https://u5hills.ru/img/53858747_1920_q70.jpg",
        alt: "Демонстрационная фотография: вид территории",
      },
      {
        src: "https://u5hills.ru/img/53858749_1920_q70.jpg",
        alt: "Демонстрационная фотография: окрестности",
      },
      {
        src: "https://u5hills.ru/img/52753815_1920_q70.jpg",
        alt: "Демонстрационная фотография: общий вид",
      },
    ],
  },
  {
    id: "local-2-02",
    settlement: "Другие участки",
    category: "Дачка",
    area: "12,4",
    price: "2900000",
    fullPaymentPrice: null,
    status: "Забронирован",
    cadastralNumber: null,
    gpzuDone: false,
    buildingPermitDone: false,
    mortgageUrl: null,
    photos: [],
  },
  {
    id: "local-2-03",
    settlement: "Другие участки",
    category: "Дачка",
    area: "8,75",
    price: "2100000",
    fullPaymentPrice: null,
    status: "Свободен",
    cadastralNumber: null,
    gpzuDone: false,
    buildingPermitDone: false,
    mortgageUrl: null,
    photos: [
      {
        src: "https://u5hills.ru/img/53858749_1920_q70.jpg",
        alt: "Демонстрационная фотография участка",
      },
    ],
  },
  {
    id: "local-2-04",
    settlement: "Другие участки",
    area: "11",
    price: "2700000",
    fullPaymentPrice: null,
    status: "Продан",
    cadastralNumber: null,
    gpzuDone: false,
    buildingPermitDone: false,
    mortgageUrl: null,
  },
];
