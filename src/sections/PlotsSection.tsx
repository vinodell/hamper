import { useState } from "react";
import {
  ArrowUpRight,
  BadgePercent,
  Check,
  CircleDollarSign,
} from "lucide-react";
import { plotFilters, plots, PlotsSectionProps, type PlotFilter } from "../lib";

export const PlotsSection = ({
  initialFilter,
}: PlotsSectionProps) => {
  const [filter, setFilter] = useState<PlotFilter>(initialFilter ?? "Все");
  const visibleFilters = initialFilter ? [initialFilter] : plotFilters;
  const filteredPlots =
    filter === "Все"
      ? plots
      : plots.filter((plot) => plot.settlement === filter);

  return (
    <section className="section section-paper" id="uchastki">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">УЧАСТКИ И ЦЕНЫ</p>
          <h2>
            Выберите <em>свой участок</em>
          </h2>
          <p>
            Актуальный список доступных предложений в мини-посёлке «Ойнеловские
            дали».
          </p>
        </div>
        <div className="sale-banner">
          <div>
            <BadgePercent />
            <div>
              <strong>Успейте забронировать на старте продаж</strong>
              <span>Выбирайте лучшие участки по стартовым ценам.</span>
            </div>
          </div>
          <a className="text-link" href="#form">
            Забронировать <ArrowUpRight size={17} />
          </a>
        </div>
        <div
          className="filter-tabs"
          role="tablist"
          aria-label="Фильтр участков"
        >
          {visibleFilters.map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <div className="plots-table-wrap">
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Посёлок</th>
                <th>Площадь</th>
                <th>Статус</th>
                <th>Цена</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filteredPlots.map((plot) => (
                <tr key={plot.id}>
                  <td>{plot.id}</td>
                  <td>{plot.settlement}</td>
                  <td>{plot.area}</td>
                  <td>
                    <span
                      className={`status status-${plot.status === "Свободен" ? "free" : "muted"}`}
                    >
                      {plot.status}
                    </span>
                  </td>
                  <td className="price">{plot.price}</td>
                  <td>
                    {plot.status === "Свободен" && (
                      <a
                        href="#form"
                        aria-label={`Забронировать участок ${plot.id}`}
                      >
                        <Check size={18} />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="price-note">
          <CircleDollarSign />
          <span>
            Минимальная площадь участка — 9 соток. Возможна рассрочка и ипотека.
          </span>
        </div>
      </div>
    </section>
  );
};
