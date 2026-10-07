import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, BadgePercent, Check, CircleDollarSign } from "lucide-react";
import { usePlots } from "../hooks/usePlots";
import { LoadingIndicator } from "../components/LoadingIndicator";
import {
  plotFilters,
  type TableSectionProps,
  type PlotFilter,
  type Plot,
} from "../lib";
import { formatPlotNumber } from "../lib/plotNumbers";

import "./Table.css";

type SortKey = "id" | "category" | "area" | "status" | "price";
type SortDirection = "asc" | "desc";

const tableColumns: {
  key: SortKey;
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

const statusOrder: Record<Plot["status"], number> = {
  Свободен: 0,
  Забронирован: 1,
  Продан: 2,
};

const toNumericValue = (value: string | undefined): number => {
  if (!value) return 0;
  const normalized = value.replace(/\s+/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const comparePlots = (left: Plot, right: Plot, key: SortKey) => {
  switch (key) {
    case "id": {
      const leftId =
        Number.parseFloat(left.id.replace(/[^\d.]/g, "")) || 0;
      const rightId =
        Number.parseFloat(right.id.replace(/[^\d.]/g, "")) || 0;
      return leftId - rightId;
    }
    case "category":
      return (left.category ?? "Уточняется").localeCompare(
        right.category ?? "Уточняется",
        "ru",
      );
    case "area":
      return toNumericValue(left.area) - toNumericValue(right.area);
    case "status":
      return statusOrder[left.status] - statusOrder[right.status];
    case "price":
      return toNumericValue(left.price) - toNumericValue(right.price);
    default:
      return 0;
  }
};

export const Table = ({
  initialFilter,
  onSelectPlot,
  sortable = false,
}: TableSectionProps) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [tableVisible, setTableVisible] = useState(false);
  const [filter, setFilter] = useState<PlotFilter>(initialFilter ?? "Все");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
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
      { threshold: 0, rootMargin: "0px 0px -40px 0px" },
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
      const result = comparePlots(left, right, sortKey);
      return sortDirection === "asc" ? result : -result;
    });
  }, [activeFilter, plots, sortDirection, sortKey, sortable]);

  const handleSort = (key: SortKey) => {
    setSortDirection((currentDirection) =>
      sortKey === key && currentDirection === "asc" ? "desc" : "asc",
    );
    setSortKey(key);
  };

  const getAriaSort = (key: SortKey) =>
    !sortable || sortKey !== key
      ? undefined
      : sortDirection === "asc"
        ? "ascending"
        : "descending";

  const getSortLabel = (key: SortKey) => {
    if (sortKey !== key) return "↕";
    return sortDirection === "asc" ? "↑" : "↓";
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
        {!initialFilter && (
          <div
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
                  onClick={(event) => {
                    if (plot.status !== "Свободен" || !onSelectPlot) return;
                    if ((event.target as HTMLElement).closest("a, button"))
                      return;
                    if (window.getSelection()?.toString()) return;
                    onSelectPlot(plot);
                    document.getElementById("form")?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                    });
                  }}
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
          <span>Возможна рассрочка и ипотека.</span>
        </div>
      </div>
    </section>
  );
};
