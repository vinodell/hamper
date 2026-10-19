import { Check, Clock3 } from "lucide-react";

import type { Plot } from "../lib/constants";

import "./PlotDetailsContent.css";

type PlotDocumentsProps = Pick<
  Plot,
  "cadastralNumber" | "gpzuDone" | "buildingPermitDone"
>;

export function FullPaymentBadge() {
  return (
    <span className="full-payment-badge tw:inline-flex tw:items-center tw:gap-1">
      При 100% оплате
    </span>
  );
}

export function PlotDocuments({
  cadastralNumber,
  gpzuDone,
  buildingPermitDone,
}: PlotDocumentsProps) {
  const documents = [
    { label: "Получен ГПЗУ", done: gpzuDone === true },
    {
      label: "Получено разрешение на строительство",
      done: buildingPermitDone === true,
    },
  ];

  return (
    <div className="plot-documents">
      <dl className="plot-documents__cadastral">
        <dt>Кадастровый номер</dt>
        <dd>{cadastralNumber?.trim() || "Не указан"}</dd>
      </dl>
      <ul className="plot-documents__list" aria-label="Документы участка">
        {documents.map(({ label, done }) => (
          <li key={label} data-done={done}>
            <span className="plot-documents__icon" aria-hidden="true">
              {done ? <Check size="1rem" /> : <Clock3 size="1rem" />}
            </span>
            <span className="plot-documents__label">{label}</span>
            <span className="plot-documents__status">
              {done ? "Выполнено" : "Не отмечено"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
