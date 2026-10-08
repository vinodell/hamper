import { ArrowUpRight } from "lucide-react";
import { InteractiveMap } from "../interactiveMap";
import { chooseZemli, type Plot } from "../lib";
import { usePlots } from "../hooks/usePlots";
import { LoadingIndicator } from "../components/LoadingIndicator";
import type { MapZone } from "../interactiveMap/Interactive.types";

import "./GeneralPlan.css";

export const GeneralPlan = ({
  onSelectPlot,
}: {
  onSelectPlot?: (plot: Plot) => void;
}) => {
  const { plots, loading, error } = usePlots();
  const handleZoneClick = (zone: MapZone) => {
    const plot = plots.find((plot) => plot.id === zone.plotId);
    if (plot?.status === "Свободен") onSelectPlot?.(plot);
  };

  return (
    <section className="section masterplan" id="genplan">
      <div className="container">
        <div className="masterplan-head">
          <div>
            <p className="eyebrow">УЧАСТКИ И ИНФРАСТРУКТУРА</p>
            <h2>
              Генеральный план
              <br />
              <em>Ойнеловских далей</em>
            </h2>
            <p>
              21 участок вдоль центрального проезда. Выберите номер на карте,
              чтобы посмотреть информацию об участке.
            </p>
          </div>
          <a className="button button-gold" href="#uchastki">
            {chooseZemli} <ArrowUpRight size="1.0625rem" />
          </a>
        </div>
        {loading && (
          <LoadingIndicator label="Загружаем статусы участков…" compact />
        )}
        {error && <p role="alert">{error}</p>}
        <div className="plan-stage">
          <img
            className="plan-background"
            src={`${import.meta.env.BASE_URL}images/masterplan-background.webp`}
            alt=""
            aria-hidden="true"
            width={1200}
            height={675}
            loading="lazy"
            decoding="async"
          />
          <figure className="plan-image">
            <InteractiveMap
              plots={plots}
              imageSrc={`${import.meta.env.BASE_URL}images/masterplan-oinelovo-1024.webp`}
              imageSrcSet={`${import.meta.env.BASE_URL}images/masterplan-oinelovo-640.webp 640w, ${import.meta.env.BASE_URL}images/masterplan-oinelovo-1024.webp 1024w`}
              imageSizes="(max-width: 47.5rem) calc(100vw - 4rem), (max-width: 54.4375rem) calc(100vw - 7rem), 47.5rem"
              imageAlt="Интерактивный план: 21 земельный участок. Выберите участок по номеру."
              onZoneClick={handleZoneClick}
            />
            <figcaption className="plan-caption">
              <span
                className="plan-status-legend"
                aria-label="Статусы участков"
              >
                <span>
                  <i className="plan-status-free" /> Свободен
                </span>
                <span>
                  <i className="plan-status-reserved" /> Забронирован
                </span>
                <span>
                  <i className="plan-status-sold" /> Продан
                </span>
              </span>
              <span className="plan-hint">
                <i aria-hidden="true" /> Нажмите на участок
              </span>
              <span>
                Иллюстративный рендер. Дома и озеленение показаны как пример.
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
};
