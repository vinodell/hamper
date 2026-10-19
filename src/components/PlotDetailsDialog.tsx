import { ArrowUpRight } from "lucide-react";

import { formatPlotNumber, type Plot } from "../lib";
import { ProjectDialog } from "./ProjectDialog";
import { FullPaymentBadge, PlotDocuments } from "./PlotDetailsContent";

import "./PlotDetailsDialog.css";

type PlotDetailsDialogProps = {
  plot: Plot;
  onClose: () => void;
  onSelectPlot?: (plot: Plot) => void;
};

export function PlotDetailsDialog({
  plot,
  onClose,
  onSelectPlot,
}: PlotDetailsDialogProps) {
  return (
    <ProjectDialog
      title={`Участок ${plot.id}`}
      className="plot-details-dialog"
      onClose={onClose}
    >
      <div className="plot-details-dialog__intro">
        <p className="plot-details-dialog__settlement">{plot.settlement}</p>
        <span
          className={`status ${plot.status === "Свободен" ? "status-free" : "status-muted"}`}
        >
          {plot.status}
        </span>
      </div>
      <dl className="plot-details-dialog__numbers">
        <div>
          <dt>Площадь</dt>
          <dd>{formatPlotNumber(plot.area)} сот.</dd>
        </div>
        <div>
          <dt>Стоимость</dt>
          <dd>
            <span>{formatPlotNumber(plot.price)} ₽</span>
            <FullPaymentBadge />
          </dd>
        </div>
      </dl>
      <PlotDocuments
        cadastralNumber={plot.cadastralNumber}
        gpzuDone={plot.gpzuDone}
        buildingPermitDone={plot.buildingPermitDone}
      />
      {plot.description && (
        <p className="plot-details-dialog__description">{plot.description}</p>
      )}
      {plot.status === "Свободен" ? (
        <a
          className="plot-details-dialog__book tw:motion-safe:transition tw:motion-safe:duration-200 tw:motion-safe:hover:-translate-y-0.5"
          href="#form"
          onClick={() => {
            onClose();
            onSelectPlot?.(plot);
          }}
        >
          Забронировать участок
          <ArrowUpRight size="1.125rem" aria-hidden="true" />
        </a>
      ) : (
        <p className="plot-details-dialog__reserved">
          Участок забронирован. Выберите свободный участок в таблице.
        </p>
      )}
    </ProjectDialog>
  );
}
