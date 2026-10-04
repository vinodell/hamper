import { ArrowUpRight } from "lucide-react";
import { InteractiveMap } from "../interactiveMap";
import { chooseZemli } from "../lib";
import { usePlots } from "../hooks/usePlots";

import "./GeneralPlan.css";

export const GeneralPlan = () => {
  const { plots, loading, error } = usePlots();

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
            {chooseZemli} <ArrowUpRight size={17} />
          </a>
        </div>
        {loading && <p role="status">Загружаем статусы участков…</p>}
        {error && <p role="alert">{error}</p>}
        <figure className="plan-image">
          <InteractiveMap
            plots={plots}
            imageSrc={`${import.meta.env.BASE_URL}images/masterplan-oinelovo-v1.webp`}
            imageAlt="Интерактивный план: 21 земельный участок. Выберите участок по номеру."
          />
          <figcaption className="plan-caption">
            <span className="plan-status-legend" aria-label="Статусы участков">
              <span><i className="plan-status-free" /> Свободен</span>
              <span><i className="plan-status-reserved" /> Забронирован</span>
              <span><i className="plan-status-sold" /> Продан</span>
            </span>
            <span className="plan-hint">
              <i aria-hidden="true" /> Нажмите на участок
            </span>
            <span>Иллюстративный рендер. Дома и озеленение показаны как пример.</span>
          </figcaption>
        </figure>
      </div>
    </section>
  );
};
