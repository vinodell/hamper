import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  CarFront,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Fence,
  House,
  Images,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Plus,
  Ruler,
  ShoppingBag,
  Trees,
  Wallet,
  Zap,
} from "lucide-react";
import { OinelovoFooter, OinelovoHeader } from "../components/OinelovoChrome";
import { ProjectDialog } from "../components/ProjectDialog";
import { PlotCarousel } from "../components/PlotCarousel";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { PlotPrice } from "../components/PlotPrice";
import { PromotionBanner } from "../components/PromotionBanner";
import { Contacts, type ContactRequestKind } from "../sections/Contacts";
import { usePlots } from "../hooks/usePlots";
import { InteractiveMap } from "../interactiveMap";
import { mapZones } from "../interactiveMap/MapZones";
import type { MapZone } from "../interactiveMap/Interactive.types";
import {
  formatPlotNumber,
  infrastructure,
  projectPageConfig,
  siteConfig,
  utilities,
  type Plot,
} from "../lib";
import type { PlotPhoto } from "../data/individualPlots";
import { TgLogo, WhatsupLogo } from "../images";

import "./Oinelovo.css";

const project = projectPageConfig["oynelovskie-dali"];
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`;
const plotNumbers = new Map(mapZones.map((zone) => [zone.plotId, zone.number]));
const pluralRules = new Intl.PluralRules("ru-RU");
const parcelWords = {
  one: "участок",
  few: "участка",
  many: "участков",
  other: "участка",
};
const parcelCount = (count: number) =>
  `${count} ${parcelWords[pluralRules.select(count) as keyof typeof parcelWords]}`;
const photos: PlotPhoto[] = [
  {
    src: "images/oinelovo/territory-1280.webp",
    alt: "Дорога и зелёная территория посёлка",
  },
  {
    src: "images/oinelovo/surroundings-1280.webp",
    alt: "Окрестности и подъезд к участкам",
  },
  {
    src: "images/oinelovo/overview-1280.webp",
    alt: "Общий вид территории и проезда",
  },
];
const mapHref = `https://yandex.ru/maps/?text=${encodeURIComponent(`${project.title}, Ленинградская область`)}`;
const hasPhone = Boolean(siteConfig.phone || siteConfig.phone2);
const hasMessenger = Boolean(
  siteConfig.maksTelegram || siteConfig.maksWhatsapp,
);
const purchaseTerms = [
  "Возможна ипотека",
  "Возможна рассрочка",
  "Выбор участка на интерактивном плане",
  "Консультация перед покупкой",
];
const questions = [
  {
    title: "Какие коммуникации есть на территории?",
    answer: utilities.map(({ title, text }) => `${title}: ${text}.`).join(" "),
  },
  {
    title: "Какой порядок покупки участка?",
    answer:
      "Выберите свободный участок на плане и оставьте заявку. Мы свяжемся с вами, договоримся о просмотре и расскажем о документах и условиях покупки.",
  },
  {
    title: "Есть ли ипотека и рассрочка?",
    answer:
      "Возможны ипотека и рассрочка. Оставьте заявку, чтобы обсудить условия для выбранного участка.",
  },
  {
    title: "Что находится рядом с посёлком?",
    answer: infrastructure.map(({ text }) => text).join(" "),
  },
];
type OpenDialog =
  "inquiry" | "gallery" | "plots" | "about" | "utilities" | "faq" | null;

function AvailablePlots({
  plots,
  onSelect,
}: {
  plots: Plot[];
  onSelect: (plot: Plot) => void;
}) {
  return (
    <ul className="oinelovo-plot-list">
      {plots.map((plot) => (
        <li key={plot.id}>
          <strong title={`Участок ${plot.id}`}>
            № {plotNumbers.get(plot.id) ?? plot.id}
          </strong>
          <span>{formatPlotNumber(plot.area)} сот.</span>
          <PlotPrice
            price={plot.price}
            fullPaymentPrice={plot.fullPaymentPrice}
          />
          <button
            className="oinelovo-button oinelovo-button--small"
            type="button"
            onClick={() => onSelect(plot)}
            aria-label={`Выбрать участок ${plot.id}`}
          >
            Выбрать
          </button>
        </li>
      ))}
    </ul>
  );
}

function Question({ title, answer }: { title: string; answer: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  return (
    <div className="oinelovo-question" data-open={open}>
      <button
        className="oinelovo-question-trigger"
        type="button"
        id={`${id}-question`}
        aria-expanded={open}
        aria-controls={`${id}-answer`}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{title}</span>
        <Plus size="1rem" aria-hidden="true" />
      </button>
      <div
        className="oinelovo-question-panel"
        id={`${id}-answer`}
        role="region"
        aria-labelledby={`${id}-question`}
        aria-hidden={!open}
        inert={!open}
      >
        <div className="oinelovo-question-answer">
          <p>{answer}</p>
        </div>
      </div>
    </div>
  );
}

function Questions() {
  return questions.map((question) => (
    <Question key={question.title} {...question} />
  ));
}

function RegionalMap() {
  return (
    <a
      className="oinelovo-region-map"
      href={mapHref}
      target="_blank"
      rel="noreferrer"
      aria-label="Найти Ойнеловские дали на Яндекс Картах"
    >
      <svg viewBox="0 0 600 300" aria-hidden="true" focusable="false">
        <defs>
          <pattern
            id="oinelovo-map-grid"
            width="44"
            height="44"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(-18)"
          >
            <path
              d="M 44 0 H 0 V 44"
              fill="none"
              stroke="var(--paper)"
              strokeWidth="3"
            />
          </pattern>
        </defs>
        <rect width="600" height="300" fill="var(--bg)" />
        <path
          d="M0 0H180L120 82 177 127 120 225 0 200ZM360 0H600V97L524 126 408 89ZM335 204L478 151 600 188V300H292Z"
          fill="color-mix(in srgb, var(--pine) 18%, var(--paper))"
        />
        <rect width="600" height="300" fill="url(#oinelovo-map-grid)" />
        <path
          d="M390-20C350 70 465 58 426 134S356 225 450 320"
          fill="none"
          stroke="color-mix(in srgb, var(--pine-light) 30%, var(--paper))"
          strokeWidth="18"
        />
        <path
          d="M-20 229C92 243 146 160 253 157S371 77 491 89L620 42"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="9"
        />
        <path
          d="M-20 229C92 243 146 160 253 157S371 77 491 89L620 42"
          fill="none"
          stroke="var(--paper)"
          strokeWidth="5"
        />
        <path
          d="M90-10L196 72 177 147 270 216 279 320M-20 91L140 104 288 47 385 89 620 246"
          fill="none"
          stroke="var(--paper)"
          strokeWidth="7"
        />
      </svg>
      <span className="oinelovo-map-label">
        <MapPin size="1.75rem" />
        <strong>
          Ойнеловские дали<small>Схема · Ленинградская область</small>
        </strong>
      </span>
      <span className="oinelovo-map-route">
        <Navigation size="1rem" /> Открыть на карте{" "}
        <ArrowRight size="0.875rem" />
      </span>
    </a>
  );
}

export function Oinelovo() {
  const { plots, loading, error } = usePlots();
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [inquirySubmitting, setInquirySubmitting] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const [requestKind, setRequestKind] = useState<ContactRequestKind>("viewing");
  const [photoIndex, setPhotoIndex] = useState(0);
  const projectPlots = useMemo(
    () => plots.filter((plot) => plot.settlement === project.plotFilter),
    [plots],
  );
  const availablePlots = useMemo(
    () => projectPlots.filter((plot) => plot.status === "Свободен"),
    [projectPlots],
  );
  const stats = useMemo(() => {
    const areas = projectPlots.map((plot) =>
      Number(plot.area.replace(",", ".")),
    );
    const prices = availablePlots.map((plot) =>
      Number((plot.fullPaymentPrice ?? plot.price).replace(",", ".")),
    );
    const minimumPrice = prices.length ? Math.min(...prices) : null;
    const minimumPricePlot =
      minimumPrice === null
        ? undefined
        : availablePlots[prices.indexOf(minimumPrice)];
    return {
      count: projectPlots.length || mapZones.length,
      area: areas.length
        ? `${formatPlotNumber(String(Math.min(...areas)))}–${formatPlotNumber(String(Math.max(...areas)))}`
        : "",
      price:
        minimumPrice === null ? "" : formatPlotNumber(String(minimumPrice)),
      priceRequiresFullPayment: Boolean(minimumPricePlot?.fullPaymentPrice),
    };
  }, [availablePlots, projectPlots]);
  const galleryPhotos = useMemo(
    () => [...photos.slice(photoIndex), ...photos.slice(0, photoIndex)],
    [photoIndex],
  );
  const plotsById = useMemo(
    () => new Map(projectPlots.map((plot) => [plot.id, plot])),
    [projectPlots],
  );
  const closeDialog = useCallback(() => setDialog(null), []);
  const openInquiry = useCallback(() => {
    setRequestKind("viewing");
    setSelectedPlot(null);
    setDialog("inquiry");
  }, []);
  const bookPlot = useCallback((plot: Plot) => {
    setRequestKind("viewing");
    setSelectedPlot({ ...plot });
    setDialog("inquiry");
  }, []);
  const handleMapBooking = useCallback(
    (zone: MapZone) => {
      const plot = plotsById.get(zone.plotId);
      if (plot?.status === "Свободен") bookPlot(plot);
    },
    [bookPlot, plotsById],
  );
  const handleMapNotification = useCallback(
    (zone: MapZone) => {
      const plot = plotsById.get(zone.plotId);
      if (plot?.status !== "Забронирован") return;
      setSelectedPlot({ ...plot });
      setRequestKind("availability");
      setDialog("inquiry");
    },
    [plotsById],
  );
  const movePhoto = useCallback((step: number) => {
    setPhotoIndex(
      (current) => (current + step + photos.length) % photos.length,
    );
  }, []);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${project.title} — ${siteConfig.brand}`;
    return () => {
      document.title = previousTitle;
    };
  }, []);

  return (
    <div className="oinelovo-page">
      <OinelovoHeader onInquiry={openInquiry} />
      <PromotionBanner />
      <main>
        <section
          className="oinelovo-screen oinelovo-screen--choose"
          aria-label="Ойнеловские дали и выбор участка"
        >
          <div className="oinelovo-hero" id="top">
            <img
              className="oinelovo-hero-image"
              src={asset("images/oinelovo/aerial-1600.webp")}
              srcSet={`${asset("images/oinelovo/aerial-768.webp")} 768w, ${asset("images/oinelovo/aerial-1600.webp")} 1600w`}
              sizes="100vw"
              width={1600}
              height={900}
              alt="Вид с высоты на зелёную территорию мини-посёлка"
              fetchPriority="high"
            />
            <div className="oinelovo-container oinelovo-hero-content">
              <nav className="oinelovo-breadcrumbs" aria-label="Хлебные крошки">
                <Link to="/#poselki">Все посёлки</Link>
                <ArrowRight size="0.875rem" aria-hidden="true" />
                <span>{project.title}</span>
              </nav>
              <div className="oinelovo-hero-copy">
                <span className="oinelovo-tag">Камерный посёлок</span>
                <h1>
                  Ойнеловские
                  <br />
                  дали
                </h1>
                <p>
                  Участки в окружении природы
                  <br />
                  всего в 25 км от КАД
                </p>
                <div className="oinelovo-hero-facts">
                  <div>
                    <MapPin />
                    <span>
                      Ленинградская область
                      <br />
                      Тишина и природа
                    </span>
                  </div>
                  <div>
                    <Fence />
                    <span>
                      <strong>{parcelCount(stats.count)}</strong>
                      <br />
                      {stats.area ? `${stats.area} соток` : "Камерный формат"}
                    </span>
                  </div>
                  <div>
                    <Wallet />
                    <span>
                      <strong>
                        {stats.price
                          ? `от ${stats.price} ₽`
                          : "Стоимость участков"}
                      </strong>
                      <br />
                      {stats.price
                        ? stats.priceRequiresFullPayment
                          ? "при 100% оплате"
                          : "за участок"
                        : "уточните у нас"}
                    </span>
                  </div>
                </div>
                <div className="oinelovo-hero-actions">
                  <a className="oinelovo-button" href="#uchastki">
                    Выбрать участок
                  </a>
                  <a
                    className="oinelovo-button oinelovo-button--light"
                    href="#location"
                  >
                    Как добраться
                  </a>
                </div>
              </div>
              <button
                className="oinelovo-hero-gallery"
                type="button"
                onClick={() => setDialog("gallery")}
              >
                <span>
                  <Images size="1.125rem" />
                </span>
                Посмотреть фотографии
                <br />
                посёлка
              </button>
            </div>
          </div>

          <section
            className="oinelovo-plan"
            id="uchastki"
            aria-labelledby="oinelovo-plan-title"
          >
            <div className="oinelovo-container oinelovo-plan-grid" id="genplan">
              <div className="oinelovo-plan-copy">
                <h2 id="oinelovo-plan-title">План посёлка</h2>
                <p>
                  Продуманные проезды и удобное расположение участков. Выберите
                  свой на интерактивном плане.
                </p>
                <ul className="oinelovo-legend" aria-label="Статусы участков">
                  <li>
                    <i className="oinelovo-status--free" />
                    Свободен
                  </li>
                  <li>
                    <i className="oinelovo-status--reserved" />
                    Забронирован
                  </li>
                  <li>
                    <i className="oinelovo-status--sold" />
                    Продан
                  </li>
                </ul>
                <a
                  className="oinelovo-button oinelovo-button--outline"
                  href={asset("images/masterplan-oinelovo-1024.webp")}
                  download="Ойнеловские-дали-план.webp"
                >
                  <Download size="1rem" />
                  Скачать план
                </a>
              </div>
              <figure className="oinelovo-plan-map">
                <span className="oinelovo-plan-compass" aria-hidden="true">
                  <span>N</span>
                  <Navigation size="1.125rem" />
                </span>
                <InteractiveMap
                  plots={projectPlots}
                  orientation="landscape"
                  imageSrc={asset("images/masterplan-oinelovo-1024.webp")}
                  imageSrcSet={`${asset("images/masterplan-oinelovo-640.webp")} 640w, ${asset("images/masterplan-oinelovo-1024.webp")} 1024w`}
                  imageSizes="(max-width: 47.5rem) 65vw, (max-width: 64rem) 38vw, (max-width: 93.333rem) 26vw, 24rem"
                  imageAlt="План Ойнеловских далей. Выберите участок, чтобы узнать площадь, цену и статус."
                  onBookPlot={handleMapBooking}
                  onNotifyPlot={handleMapNotification}
                />
                <figcaption>
                  Нажмите на номер участка · Иллюстративный рендер
                </figcaption>
              </figure>
              <aside
                className="oinelovo-available"
                aria-labelledby="oinelovo-available-title"
              >
                <h3 id="oinelovo-available-title">Свободные участки</h3>
                {loading && (
                  <LoadingIndicator label="Загружаем участки…" compact />
                )}
                {error && (
                  <p className="oinelovo-data-error" role="alert">
                    {error}
                  </p>
                )}
                <AvailablePlots
                  plots={availablePlots.slice(0, 5)}
                  onSelect={bookPlot}
                />
                {!loading && !error && !availablePlots.length && (
                  <p>
                    Свободных участков пока нет. Свяжитесь с нами, чтобы узнать
                    о новых предложениях.
                  </p>
                )}
                {projectPlots.length > 0 && (
                  <p className="oinelovo-available-total">
                    В продаже: {parcelCount(availablePlots.length)}
                  </p>
                )}
                {availablePlots.length > 5 && (
                  <button
                    className="oinelovo-text-button"
                    type="button"
                    onClick={() => setDialog("plots")}
                  >
                    Все свободные участки <ArrowRight size="0.875rem" />
                  </button>
                )}
              </aside>
            </div>
          </section>
        </section>

        <section
          className="oinelovo-screen oinelovo-screen--life"
          aria-label="Жизнь в посёлке"
          id="about"
        >
          <div className="oinelovo-container">
            <div className="oinelovo-about-grid">
              <div className="oinelovo-about-copy">
                <h2>О посёлке</h2>
                <p>
                  «Ойнеловские дали» — камерный посёлок на{" "}
                  {parcelCount(stats.count)}, расположенный в окружении природы.
                  Приватная территория для тех, кто ценит тишину, собственное
                  пространство и узкий круг соседей.
                </p>
                <div className="oinelovo-about-facts">
                  <div>
                    <span>
                      <Fence />
                    </span>
                    <strong>
                      {stats.count}
                      <small>в посёлке</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <Ruler />
                    </span>
                    <strong>
                      {stats.area || "Участки"}
                      <small>{stats.area ? "соток" : "разной площади"}</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <Trees />
                    </span>
                    <strong>
                      Общие зоны<small>отдыха</small>
                    </strong>
                  </div>
                  <div>
                    <span>
                      <Zap />
                    </span>
                    <strong>
                      Современные<small>коммуникации</small>
                    </strong>
                  </div>
                </div>
                <button
                  className="oinelovo-button"
                  type="button"
                  onClick={() => setDialog("about")}
                >
                  Узнать больше о проекте
                </button>
              </div>
              <div
                className="oinelovo-about-photo"
                role="region"
                aria-label="Фотографии территории"
              >
                <img
                  src={asset(photos[photoIndex].src)}
                  srcSet={`${asset(photos[photoIndex].src.replace("1280", "640"))} 640w, ${asset(photos[photoIndex].src)} 1280w`}
                  sizes="(max-width: 47.5rem) 100vw, 55vw"
                  width={1280}
                  height={960}
                  alt={photos[photoIndex].alt}
                  loading="lazy"
                  decoding="async"
                />
                <div className="oinelovo-photo-arrows">
                  <button
                    type="button"
                    onClick={() => movePhoto(-1)}
                    aria-label="Предыдущая фотография"
                  >
                    <ChevronLeft size="1.125rem" />
                  </button>
                  <button
                    type="button"
                    onClick={() => movePhoto(1)}
                    aria-label="Следующая фотография"
                  >
                    <ChevronRight size="1.125rem" />
                  </button>
                </div>
              </div>
            </div>

            <div className="oinelovo-amenities-grid" id="advantages">
              <div className="oinelovo-gallery-block">
                <h3>Фотографии территории</h3>
                <div className="oinelovo-thumbnails">
                  {galleryPhotos.map((photo) => (
                    <button
                      key={photo.src}
                      type="button"
                      onClick={() => {
                        setPhotoIndex(photos.indexOf(photo));
                        setDialog("gallery");
                      }}
                      aria-label={`Открыть фотографию: ${photo.alt}`}
                    >
                      <img
                        src={asset(photo.src.replace("1280", "640"))}
                        width={640}
                        height={480}
                        alt={photo.alt}
                        loading="lazy"
                        decoding="async"
                      />
                    </button>
                  ))}
                  <button
                    className="oinelovo-thumbnail-prev"
                    type="button"
                    onClick={() => movePhoto(-1)}
                    aria-label="Предыдущие фотографии"
                  >
                    <ChevronLeft size="1rem" />
                  </button>
                  <button
                    className="oinelovo-thumbnail-next"
                    type="button"
                    onClick={() => movePhoto(1)}
                    aria-label="Следующие фотографии"
                  >
                    <ChevronRight size="1rem" />
                  </button>
                </div>
                <button
                  className="oinelovo-button oinelovo-button--outline"
                  type="button"
                  onClick={() => setDialog("gallery")}
                >
                  Смотреть все фото
                </button>
              </div>
              <div className="oinelovo-utilities-block">
                <h3>Коммуникации и дороги</h3>
                <dl className="oinelovo-utilities">
                  {utilities.map(({ icon: Icon, title, text }) => (
                    <div key={title}>
                      <dt>
                        <span>
                          <Icon size="1.0625rem" />
                        </span>
                        {title}
                      </dt>
                      <dd>{text}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <aside className="oinelovo-documents">
                <House size="3.5rem" strokeWidth={0.8} aria-hidden="true" />
                <p>
                  Все коммуникации
                  <br />и условия подключения —<br />
                  подробнее о проекте
                </p>
                <button
                  className="oinelovo-button"
                  type="button"
                  onClick={() => setDialog("utilities")}
                >
                  Информация о посёлке
                </button>
              </aside>
            </div>
          </div>
        </section>

        <section
          className="oinelovo-screen oinelovo-screen--visit"
          aria-label="Расположение, покупка и контакты"
        >
          <div
            className="oinelovo-container oinelovo-location-grid"
            id="location"
          >
            <div className="oinelovo-location-copy">
              <h3>Расположение</h3>
              <p>
                Ленинградская область, всего 25 км от КАД. Природа и спокойствие
                загородной жизни с необходимой инфраструктурой рядом.
              </p>
              <div className="oinelovo-location-facts">
                <div>
                  <CarFront size="1.125rem" />
                  <strong>25 км</strong>
                  <span>от КАД</span>
                </div>
                <div>
                  <Clock3 size="1.125rem" />
                  <strong>5–10 мин</strong>
                  <span>до магазинов</span>
                </div>
                <div>
                  <ShoppingBag size="1.125rem" />
                  <strong>Всё рядом</strong>
                  <span>для жизни</span>
                </div>
              </div>
            </div>
            <RegionalMap />
            <div className="oinelovo-purchase">
              <h3>Условия покупки</h3>
              <ul>
                {purchaseTerms.map((term) => (
                  <li key={term}>
                    <Check size="1rem" />
                    {term}
                  </li>
                ))}
              </ul>
              <button
                className="oinelovo-button oinelovo-button--outline"
                type="button"
                onClick={openInquiry}
              >
                Получить консультацию
              </button>
            </div>
          </div>

          <div className="oinelovo-closing" id="form">
            <div className="oinelovo-container oinelovo-closing-grid">
              <div className="oinelovo-faq">
                <h3>Частые вопросы</h3>
                <Questions />
                <button
                  className="oinelovo-text-button"
                  type="button"
                  onClick={() => setDialog("faq")}
                >
                  Все вопросы и ответы <ArrowRight size="0.875rem" />
                </button>
              </div>
              <div className="oinelovo-visit-card">
                <img
                  src={asset("images/oinelovo/aerial-768.webp")}
                  width={768}
                  height={432}
                  alt=""
                  loading="lazy"
                  decoding="async"
                />
                <div>
                  <h3>
                    Хотите узнать больше
                    <br />
                    или записаться на просмотр?
                  </h3>
                  <p>
                    Оставьте заявку, и мы расскажем о свободных участках,
                    актуальных ценах и ответим на все вопросы.
                  </p>
                  <button
                    className="oinelovo-button"
                    type="button"
                    onClick={openInquiry}
                  >
                    Оставить заявку
                  </button>
                </div>
              </div>
              <address className="oinelovo-contact-card">
                <div>
                  <Phone size="1.625rem" />
                  <span>
                    {siteConfig.phone && (
                      <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
                    )}
                    {siteConfig.phone2 && (
                      <a href={siteConfig.phone2Href}>{siteConfig.phone2}</a>
                    )}
                    {!hasPhone && (
                      <button
                        className="oinelovo-contact-action"
                        type="button"
                        onClick={openInquiry}
                      >
                        Связаться с нами
                      </button>
                    )}
                    <small>{siteConfig.hours}</small>
                  </span>
                </div>
                <div className="oinelovo-messengers">
                  {hasMessenger ? (
                    <span
                      className="oinelovo-messenger-icons"
                      aria-hidden="true"
                    >
                      {siteConfig.maksWhatsapp && <WhatsupLogo />}
                      {siteConfig.maksTelegram && <TgLogo />}
                    </span>
                  ) : (
                    <MessageCircle size="1.625rem" />
                  )}
                  <span>
                    {siteConfig.maksTelegram && (
                      <a
                        href={`https://t.me/${siteConfig.maksTelegram}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Написать в Telegram
                      </a>
                    )}
                    {siteConfig.maksWhatsapp && (
                      <a
                        href={`https://wa.me/${siteConfig.maksWhatsapp}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Написать в WhatsApp
                      </a>
                    )}
                    {!hasMessenger && (
                      <button
                        className="oinelovo-contact-action"
                        type="button"
                        onClick={openInquiry}
                      >
                        Задать вопрос
                      </button>
                    )}
                  </span>
                </div>
                <div>
                  <MapPin size="1.625rem" />
                  <span>
                    Ленинградская область<small>Ойнеловские дали</small>
                  </span>
                </div>
              </address>
            </div>
          </div>
        </section>
      </main>
      <OinelovoFooter />

      {dialog === "inquiry" && (
        <ProjectDialog
          title={
            requestKind === "availability"
              ? "Уведомить об освобождении"
              : "Записаться на просмотр"
          }
          onClose={closeDialog}
          className="oinelovo-inquiry"
          closeDisabled={inquirySubmitting}
          icon={
            requestKind === "availability" ? (
              <BellRing size={22} strokeWidth={1.75} />
            ) : (
              <CalendarDays size={22} strokeWidth={1.75} />
            )
          }
        >
          <Contacts
            selectedPlot={selectedPlot}
            requestKind={requestKind}
            initialProject={project.plotFilter}
            id="inquiry-form"
            variant="dialog"
            onSubmittingChange={setInquirySubmitting}
          />
        </ProjectDialog>
      )}
      {dialog === "gallery" && (
        <ProjectDialog
          title="Фотографии территории"
          onClose={closeDialog}
          className="oinelovo-photo-dialog"
        >
          <PlotCarousel photos={galleryPhotos} title={project.title} />
        </ProjectDialog>
      )}
      {dialog === "plots" && (
        <ProjectDialog title="Все свободные участки" onClose={closeDialog}>
          <AvailablePlots plots={availablePlots} onSelect={bookPlot} />
          {!availablePlots.length && <p>Свободных участков пока нет.</p>}
        </ProjectDialog>
      )}
      {dialog === "faq" && (
        <ProjectDialog title="Вопросы о посёлке" onClose={closeDialog}>
          <Questions />
        </ProjectDialog>
      )}
      {dialog === "utilities" && (
        <ProjectDialog title="Коммуникации и дороги" onClose={closeDialog}>
          <dl className="oinelovo-utilities">
            {utilities.map(({ title, text }) => (
              <div key={title}>
                <dt>{title}</dt>
                <dd>{text}</dd>
              </div>
            ))}
          </dl>
          <p>
            Уточним условия подключения и ответим на вопросы во время
            консультации.
          </p>
          <button
            className="oinelovo-button"
            type="button"
            onClick={openInquiry}
          >
            Получить консультацию
          </button>
        </ProjectDialog>
      )}
      {dialog === "about" && (
        <ProjectDialog title="Ойнеловские дали" onClose={closeDialog}>
          <p>
            Камерный посёлок на {parcelCount(stats.count)}. Приватная
            территория, общие зоны отдыха, детская площадка и гостевая парковка.
          </p>
          {infrastructure.map(({ icon: Icon, title, text }) => (
            <article className="oinelovo-detail" key={title}>
              <Icon size="1.5rem" />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </article>
          ))}
          <button
            className="oinelovo-button"
            type="button"
            onClick={openInquiry}
          >
            Записаться на просмотр
          </button>
        </ProjectDialog>
      )}
    </div>
  );
}
