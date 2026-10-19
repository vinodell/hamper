import { CheckCircle2, FileCheck2, Link2 } from "lucide-react";
import type { PlotUpdate } from "../lib/api";

type PlotMetadata = Pick<
  PlotUpdate,
  "cadastralNumber" | "gpzuDone" | "buildingPermitDone" | "mortgageUrl"
>;

interface AdminPlotMetadataProps {
  value: PlotMetadata;
  onChange: (value: PlotMetadata) => void;
  disabled: boolean;
  plotId?: string;
}

export function AdminPlotMetadata({
  value,
  onChange,
  disabled,
  plotId = "нового участка",
}: AdminPlotMetadataProps) {
  return (
    <fieldset className="admin-metadata-fields" disabled={disabled}>
      <legend className="admin-visually-hidden">
        Документы участка {plotId}
      </legend>
      <label>
        <span>
          <FileCheck2 size={15} aria-hidden="true" /> Кадастровый номер
        </span>
        <input
          value={value.cadastralNumber}
          onChange={(event) =>
            onChange({ ...value, cadastralNumber: event.target.value })
          }
          aria-label={`Кадастровый номер ${plotId}`}
          maxLength={80}
          placeholder="47:07:0000000:123"
          spellCheck={false}
        />
      </label>
      <div className="admin-document-checks">
        <label className="admin-document-check">
          <input
            type="checkbox"
            checked={value.gpzuDone}
            onChange={(event) =>
              onChange({ ...value, gpzuDone: event.target.checked })
            }
            aria-label={`ГПЗУ получен ${plotId}`}
          />
          <span>
            <strong>ГПЗУ получен</strong>
            <small>{value.gpzuDone ? "Выполнено" : "Пока не отмечено"}</small>
          </span>
          <CheckCircle2 size={18} aria-hidden="true" />
        </label>
        <label className="admin-document-check">
          <input
            type="checkbox"
            checked={value.buildingPermitDone}
            onChange={(event) =>
              onChange({ ...value, buildingPermitDone: event.target.checked })
            }
            aria-label={`Разрешение на строительство ${plotId}`}
          />
          <span>
            <strong>Разрешение на строительство</strong>
            <small>
              {value.buildingPermitDone ? "Выполнено" : "Пока не отмечено"}
            </small>
          </span>
          <CheckCircle2 size={18} aria-hidden="true" />
        </label>
      </div>
      <label>
        <span>
          <Link2 size={15} aria-hidden="true" /> Объявление для ипотеки
        </span>
        <input
          type="url"
          value={value.mortgageUrl}
          onChange={(event) =>
            onChange({ ...value, mortgageUrl: event.target.value })
          }
          aria-label={`Ссылка Домклик ${plotId}`}
          maxLength={2048}
          placeholder="https://spb.domclick.ru/card/…"
          spellCheck={false}
          autoCapitalize="none"
        />
        <small>Ссылка на объявление участка в Домклик / Сбере.</small>
      </label>
    </fieldset>
  );
}
