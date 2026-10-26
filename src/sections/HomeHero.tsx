import { ArrowDown, ArrowUpRight, Coins, House, Ruler } from "lucide-react";
import { usePlots } from "../hooks/usePlots";
import { formatPlotNumber, projectRoutes } from "../lib";
import { summarizePlots } from "../lib/plotSummary";

const asset = (name: string) =>
  `${import.meta.env.BASE_URL}images/nature/${name}`;

export function HomeHero() {
  const { plots } = usePlots();
  const available = plots.filter((plot) => plot.status === "Свободен");
  const summary = summarizePlots(available);
  const minArea =
    summary.minimumArea === null
      ? null
      : formatPlotNumber(String(summary.minimumArea));
  const maxArea =
    summary.maximumArea === null
      ? null
      : formatPlotNumber(String(summary.maximumArea));
  const minPrice =
    summary.minimumAvailablePrice === null
      ? null
      : formatPlotNumber(String(summary.minimumAvailablePrice));

  return (
    <section className="home-hero" id="top" aria-labelledby="home-title">
      <img
        className="home-hero__image"
        src={asset("home-1920.webp")}
        srcSet={`${asset("home-960.webp")} 960w, ${asset("home-1920.webp")} 1920w`}
        sizes="100vw"
        width={1920}
        height={768}
        alt=""
        fetchPriority="high"
      />
      <div className="container home-hero__inner">
        <h1 id="home-title">
          Мини-послеки
          <br />
          Хампер village
        </h1>
        <p className="home-hero__copy">
          Создаём продуманные загородные проекты
          <br className="home-desktop-break" /> в живописных местах
          Ленинградской области.
        </p>
        <div className="home-hero__facts">
          <div>
            <House size={28} strokeWidth={1.35} aria-hidden="true" />
            <span>
              <strong>{projectRoutes.length} проекта</strong>
              <small>выберите свой</small>
            </span>
          </div>
          <div>
            <Ruler size={28} strokeWidth={1.35} aria-hidden="true" />
            <span>
              <strong>
                {minArea && maxArea
                  ? minArea === maxArea
                    ? `${minArea} соток`
                    : `${minArea}–${maxArea} соток`
                  : "Участки для жизни"}
              </strong>
              <small>площадь участков</small>
            </span>
          </div>
          <div>
            <Coins size={28} strokeWidth={1.35} aria-hidden="true" />
            <span>
              <strong>
                {minPrice ? `от ${minPrice} ₽` : "Подберём участок"}
              </strong>
              <small>
                {minPrice ? "стоимость участков" : "под ваш бюджет"}
              </small>
            </span>
          </div>
        </div>
        <div className="home-hero__actions">
          <a className="home-button home-button--primary" href="#poselki">
            Смотреть проекты <ArrowUpRight size={18} aria-hidden="true" />
          </a>
          <a className="home-button home-button--outline" href="#form">
            Связаться <ArrowDown size={17} aria-hidden="true" />
          </a>
        </div>
      </div>
      <span className="home-hero__caption" aria-hidden="true">
        Ближе к природе. Ближе к себе.
      </span>
    </section>
  );
}
