import { usePlots } from "../hooks/usePlots";
import { formatPlotNumber } from "../lib/plotNumbers";
import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  BadgePercent,
  Check,
  CircleDollarSign,
} from "lucide-react";
import { plotFilters, type TableSectionProps, type PlotFilter } from "../lib";

export const Table = ({ initialFilter, onSelectPlot }: TableSectionProps) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableVisible, setTableVisible] = useState(false);

  useEffect(() => {
    const element = tableRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setTableVisible(true);
      return;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setTableVisible(true);
        observer.disconnect();
      }
    }, { threshold: 0, rootMargin: "0px 0px -40px 0px" });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const [filter, setFilter] = useState<PlotFilter>(initialFilter ?? "Все");
  const { plots, loading, error } = usePlots();
  const activeFilter = initialFilter ?? filter;
  const filteredPlots = plots.filter(
    (plot) =>
      (plot.status === "Свободен" || plot.status === "Забронирован") &&
      (activeFilter === "Все" || plot.settlement === activeFilter),
  );

  return (
    <section className="section section-paper" id="uchastki">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">УЧАСТКИ И ЦЕНЫ</p>
          <h2>
            Выберите <em>свой участок</em>
          </h2>
          <p>
            {initialFilter ? `Актуальные участки проекта «${initialFilter}».` : "Актуальные участки всех проектов."}
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
        {!initialFilter && <div
          className="filter-tabs"
          role="tablist"
          aria-label="Фильтр участков"
        >
          {plotFilters.map((item) => (
            <button
              key={item}
              className={filter === item ? "active" : ""}
              onClick={() => setFilter(item)}
            >
              {item}
            </button>
          ))}
        </div>}
        {loading && <p role="status">Загружаем участки…</p>}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && filteredPlots.length === 0 && <p>Свободных и забронированных участков пока нет.</p>}
        <div ref={tableRef} className={`plots-table-wrap${tableVisible ? " plots-table-visible" : ""}`}>
          <table>
            <thead>
              <tr>
                <th>№</th>
                <th>Посёлок</th>
                <th>Площадь, сот.</th>
                <th>Статус</th>
                <th>Цена, ₽</th>
                <th />
              </tr>
            </thead>
            <tbody key={activeFilter}>
              {filteredPlots.map((plot, index) => (
                <tr
                  key={plot.id}
                  className={plot.status === "Свободен" && onSelectPlot ? "plot-row-selectable" : undefined}
                  style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  onClick={(event) => {
                    if (plot.status !== "Свободен" || !onSelectPlot) return;
                    if ((event.target as HTMLElement).closest("a, button")) return;
                    if (window.getSelection()?.toString()) return;
                    onSelectPlot(plot);
                    document.getElementById("form")?.scrollIntoView({
                      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
                    });
                  }}
                >
                  <td>{plot.id}</td>
                  <td>{plot.settlement}</td>
                  <td>{formatPlotNumber(plot.area)}</td>
                  <td>
                    <span
                      className={`status status-${plot.status === "Свободен" ? "free" : "muted"}`}
                    >
                      {plot.status}
                    </span>
                  </td>
                  <td className="price">{formatPlotNumber(plot.price)}</td>
                  <td>
                    {plot.status === "Свободен" && (
                      <a
                        className="plot-booking"
                        onClick={() => onSelectPlot?.(plot)}
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
            Возможна рассрочка и ипотека.
          </span>
        </div>
      </div>
    </section>
  );
};
