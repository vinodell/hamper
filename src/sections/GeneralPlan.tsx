import { ArrowUpRight } from "lucide-react";
import { InteractiveMap } from "../interactiveMap";
import { chooseZemli } from "../lib";

import "./GeneralPlan.css";

export const GeneralPlan = () => (
  <section className="section masterplan" id="genplan">
    <div className="container">
      <div className="masterplan-head">
        <div>
          <p className="eyebrow">УЧАСТКИ И ИНФРАСТРУКТУРА</p>
          <h2>
            Генеральный план
            <br />
            <em>посёлков</em>
          </h2>
          <p>
            Продуманная планировка мини-посёлков обеспечивает комфорт и
            безопасность каждого жителя.
          </p>
        </div>
        <a className="button button-gold" href="#uchastki">
          {chooseZemli} <ArrowUpRight size={17} />
        </a>
      </div>
      <div
        className="plan-tabs"
        role="tablist"
        aria-label="Генеральные планы"
      ></div>
      <div className="plan-image">
        <InteractiveMap
          imageSrc="/images/plan.webp"
          imageAlt="Генеральный план земельных участков"
        />
        <div className="plan-legend">
          <span>
            <i className="legend-green" /> Свободные участки
          </span>
          <span>
            <i className="legend-road" /> Забронированные участки
          </span>
          <span>
            <i className="legend-olive" /> Купленные участки
          </span>
          <span>
            <i className="legend-olive" /> Общие зоны
          </span>
        </div>
      </div>
    </div>
  </section>
);
