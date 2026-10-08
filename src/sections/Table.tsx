import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  BadgePercent,
  Check,
  CircleDollarSign,
} from "lucide-react";
import { usePlots } from "../hooks/usePlots";
import { LoadingIndicator } from "../components/LoadingIndicator";
import { plotFilters, type TableSectionProps, type PlotFilter } from "../lib";
import { formatPlotNumber } from "../lib/plotNumbers";
import { comparePlots, type PlotSortKey } from "../lib/plotSorting";

import "./Table.css";

type SortDirection = "asc" | "desc";

const tableColumns: {
  key: PlotSortKey;
  label: string;
  sortLabel: string;
}[] = [
  { key: "id", label: "№", sortLabel: "Сортировать по номеру участка" },
  {
    key: "category",
    label: "Категория",
    sortLabel: "Сортировать по категории",
  },
  { key: "area", label: "Площадь, сот.", sortLabel: "Сортировать по площади" },
  { key: "status", label: "Статус", sortLabel: "Сортировать по статусу" },
  { key: "price", label: "Цена, ₽", sortLabel: "Сортировать по цене" },
];

export const Table = ({
  initialFilter,
  onSelectPlot,
  sortable = false,
}: TableSectionProps) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableVisible, setTableVisible] = useState(false);
  const [filter, setFilter] = useState<PlotFilter>(initialFilter ?? "Все");
  const [sort, setSort] = useState<{
    key: PlotSortKey;
    direction: SortDirection;
  }>({ key: "id", direction: "asc" });
  const { plots, loading, error } = usePlots();
  const activeFilter = initialFilter ?? filter;

  useEffect(() => {
    const element = tableRef.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      setTableVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTableVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0, rootMargin: "0% 0% -5% 0%" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const filteredPlots = useMemo(() => {
    const nextPlots = plots.filter(
      (plot) =>
        plot.status !== "Продан" &&
        (activeFilter === "Все" || plot.settlement === activeFilter),
    );

    if (!sortable) {
      return nextPlots;
    }

    return nextPlots.sort((left, right) => {
      const result = comparePlots(left, right, sort.key);
      return sort.direction === "asc" ? result : -result;
    });
  }, [activeFilter, plots, sort, sortable]);

  const handleSort = (key: PlotSortKey) => {
    setSort((current) => ({
      key,
      direction:
        current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const getAriaSort = (key: PlotSortKey) =>
    !sortable || sort.key !== key
      ? undefined
      : sort.direction === "asc"
        ? "ascending"
        : "descending";

  const getSortLabel = (key: PlotSortKey) => {
    if (sort.key !== key) return "↕";
    return sort.direction === "asc" ? "↑" : "↓";
  };

  return (
    <section className="section section-paper" id="uchastki">
      <div className="container">
        <div className="section-heading">
          <p className="eyebrow">УЧАСТКИ И ЦЕНЫ</p>
          <h2>
            Выберите <em>свой участок</em>
          </h2>
          <p>
            {initialFilter
              ? `Актуальные участки проекта «${initialFilter}».`
              : "Актуальные участки всех проектов."}
          </p>
        </div>
        <div className="sale-banner">
          <div>
            <BadgePercent size="1.5rem" />
            <div>
              <strong>Успейте забронировать на старте продаж</strong>
              <span>Выбирайте лучшие участки по стартовым ценам.</span>
            </div>
          </div>
          <a className="text-link" href="#form">
            Забронировать <ArrowUpRight size="1.0625rem" />
          </a>
        </div>
        {!initialFilter && (
          <div
            className="filter-tabs"
            role="group"
            aria-label="Фильтр участков"
          >
            {plotFilters.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? "active" : ""}
                aria-pressed={filter === item}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        )}
        {loading && <LoadingIndicator />}
        {error && <p role="alert">{error}</p>}
        {!loading && !error && filteredPlots.length === 0 && (
          <p>Участков с выбранными условиями пока нет.</p>
        )}
        <div
          ref={tableRef}
          className={`plots-table-wrap${tableVisible ? " plots-table-visible" : ""}`}
        >
          <table>
            <thead>
              <tr>
                {tableColumns.map(({ key, label, sortLabel }) => (
                  <th key={key} scope="col" aria-sort={getAriaSort(key)}>
                    {sortable ? (
                      <button
                        type="button"
                        className="sort-button"
                        onClick={() => handleSort(key)}
                        aria-label={sortLabel}
                      >
                        {label}{" "}
                        <span aria-hidden="true">{getSortLabel(key)}</span>
                      </button>
                    ) : key === "category" ? (
                      "Посёлок"
                    ) : (
                      label
                    )}
                  </th>
                ))}
                <th scope="col" aria-label="Действие" />
              </tr>
            </thead>
            <tbody key={activeFilter}>
              {filteredPlots.map((plot, index) => (
                <tr
                  key={plot.id}
                  className={
                    plot.status === "Свободен" && onSelectPlot
                      ? "plot-row-selectable"
                      : undefined
                  }
                  style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                  onClick={
                    plot.status === "Свободен" && onSelectPlot
                      ? (event) => {
                          if (
                            (event.target instanceof Element &&
                              event.target.closest("a, button")) ||
                            window.getSelection()?.toString()
                          )
                            return;
                          event.currentTarget
                            .querySelector<HTMLAnchorElement>(".plot-booking")
                            ?.click();
                        }
                      : undefined
                  }
                >
                  <td>{plot.id}</td>
                  <td>
                    {sortable
                      ? (plot.category ?? "Уточняется")
                      : plot.settlement}
                  </td>
                  <td>{formatPlotNumber(plot.area)}</td>
                  <td>
                    <span
                      className={`status ${plot.status === "Свободен" ? "status-free" : "status-muted"}`}
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
                        <Check size="1.125rem" />
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="price-note">
          <CircleDollarSign size="1.5rem" />
          <span>Возможна рассрочка и ипотека.</span>
        </div>
      </div>
    </section>
  );
};
