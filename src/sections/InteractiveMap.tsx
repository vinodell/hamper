import { useState } from "react";
import { ArrowUpRight } from "lucide-react";
import { chooseZemli, masterplans } from "../lib";

interface InteractiveMap {
  selectedPlan?: 0 | 1;
}

export const InteractiveMap = ({ selectedPlan }: InteractiveMap) => {
  const [activePlan, setActivePlan] = useState<0 | 1>(selectedPlan ?? 0);
  const displayedPlan = selectedPlan ?? activePlan;
  const visiblePlans =
    selectedPlan === undefined
      ? masterplans.map((plan, index) => ({ plan, index }))
      : [{ plan: masterplans[selectedPlan], index: selectedPlan }];

  return (
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
        >
          {visiblePlans.map(({ plan, index }) => (
            <button
              className={displayedPlan === index ? "active" : ""}
              role="tab"
              aria-selected={displayedPlan === index}
              key={plan.label}
              onClick={() => setActivePlan(index as 0 | 1)}
            >
              {plan.label}
            </button>
          ))}
        </div>
        <div className="plan-image">
          <img
            loading="lazy"
            decoding="async"
            src={masterplans[displayedPlan].image}
            alt={`Генплан ${masterplans[displayedPlan].label}`}
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
};
