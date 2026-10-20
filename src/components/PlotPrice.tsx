import { Banknote } from "lucide-react";

import { formatPlotNumber } from "../lib/plotNumbers";

import "./PlotPrice.css";

interface PlotPriceProps {
  price: string | number;
  fullPaymentPrice?: string | number | null;
  className?: string;
}

export function PlotPrice({
  price,
  fullPaymentPrice,
  className = "",
}: PlotPriceProps) {
  const hasFullPaymentPrice =
    fullPaymentPrice !== undefined &&
    fullPaymentPrice !== null &&
    String(fullPaymentPrice).trim() !== "";
  const format = (value: string | number) =>
    `${formatPlotNumber(String(value))} ₽`;

  return (
    <span
      className={`plot-price ${className}`.trim()}
      data-full-payment={hasFullPaymentPrice ? "true" : undefined}
    >
      {hasFullPaymentPrice && (
        <span className="plot-price__original">
          <span className="plot-price__sr-only">Базовая цена: </span>
          <s>{format(price)}</s>
        </span>
      )}
      <strong className="plot-price__value">
        {hasFullPaymentPrice && (
          <span className="plot-price__sr-only">Цена при полной оплате: </span>
        )}
        {format(hasFullPaymentPrice ? fullPaymentPrice : price)}
      </strong>
      {hasFullPaymentPrice && (
        <span className="full-payment-badge tw:inline-flex tw:items-center tw:gap-1">
          <Banknote size={13} strokeWidth={1.75} aria-hidden="true" />
          При 100% оплате
        </span>
      )}
    </span>
  );
}
