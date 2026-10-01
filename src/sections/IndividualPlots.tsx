import { useState } from "react";
import { usePlots } from "../hooks";
import { PlotCarousel } from "../components/PlotCarousel";
import { formatPlotNumber } from "../lib/plotNumbers";
import type { Plot } from "../lib/constants";

import "./IndividualPlots.css";

export function IndividualPlots({ onSelectPlot }: { onSelectPlot: (plot: Plot) => void }) {
  const { plots, loading, error } = usePlots();
  const [selectedId, setSelectedId] = useState("");
  const available = plots.filter((plot) => plot.settlement === "Другие участки" && plot.status !== "Продан");
  const selected = available.find((plot) => plot.id === selectedId) ?? available[0];

  return <section className="section individual-plots" aria-labelledby="individual-plots-heading">
    <div className="container">
      <div className="section-heading">
        <p className="eyebrow">ОТДЕЛЬНЫЕ ЗЕМЕЛЬНЫЕ УЧАСТКИ</p>
        <h2 id="individual-plots-heading">Место для <em>ваших планов</em></h2>
        <p>Выберите участок, посмотрите фотографии и сравните предложения в таблице ниже.</p>
      </div>
      {loading && <p role="status">Загружаем участки…</p>}
      {error && <p role="alert">{error}</p>}
      {!loading && !error && !selected && <p>Новые предложения скоро появятся.</p>}
      {!!available.length && <label className="individual-plots-picker">Выберите участок
        <select value={selected?.id ?? ""} onChange={(event) => setSelectedId(event.target.value)}>
          {available.map((plot) => <option key={plot.id} value={plot.id}>{plot.title ?? `Участок ${plot.id}`} · {formatPlotNumber(plot.area)} сот.</option>)}
        </select>
      </label>}
      {selected && <article className="individual-plot" aria-label={`Участок ${selected.id}`}>
        <PlotCarousel key={selected.id} photos={selected.photos ?? []} title={selected.title ?? selected.id} />
        <div className="individual-plot-details">
          <div><p className="eyebrow">{selected.category ?? "Категория уточняется"}</p><h3>{selected.title ?? `Участок ${selected.id}`}</h3></div>
          <dl><div><dt>Площадь</dt><dd>{formatPlotNumber(selected.area)} сот.</dd></div><div><dt>Стоимость</dt><dd>{formatPlotNumber(selected.price)} ₽</dd></div><div><dt>Статус</dt><dd>{selected.status}</dd></div></dl>
          {selected.status === "Свободен" && <a className="button button-gold" href="#form" onClick={() => onSelectPlot(selected)}>Записаться на просмотр</a>}
        </div>
      </article>}
    </div>
  </section>;
}
