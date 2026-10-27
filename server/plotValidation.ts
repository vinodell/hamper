import {
  allowedStatuses,
  PLOT_ID_MAX_LENGTH,
  PLOT_STREET_MAX_LENGTH,
  PLOT_DESCRIPTION_MAX_LENGTH,
  PLOT_CADASTRAL_NUMBER_MAX_LENGTH,
  PLOT_MORTGAGE_URL_MAX_LENGTH,
  FULL_PAYMENT_PRICE_ERROR,
  type PlotStatus,
} from "./constants.js";
import { optionalText, ValidationError } from "./validation.js";

export interface PlotUpdate {
  area: string;
  status: PlotStatus;
  price: string;
  fullPaymentPrice?: string | null;
  street?: string | null;
  description?: string | null;
  cadastralNumber?: string | null;
  gpzuDone?: boolean;
  buildingPermitDone?: boolean;
  mortgageUrl?: string | null;
}

export function validatePlotId(value: unknown) {
  if (typeof value !== "string" || /[\u0000-\u001f\u007f-\u009f]/.test(value))
    throw new ValidationError("Некорректный номер участка");
  const id = value.trim();
  if (!id || id.length > PLOT_ID_MAX_LENGTH)
    throw new ValidationError("Некорректный номер участка");
  return id;
}

function positiveDecimal(value: unknown) {
  if (typeof value !== "string")
    throw new ValidationError("Некорректные данные участка");
  const decimal = value.trim().replace(",", ".");
  const number = Number(decimal);
  if (
    !/^\d+(?:\.\d{1,2})?$/.test(decimal) ||
    !Number.isFinite(number) ||
    number <= 0
  )
    throw new ValidationError("Некорректные данные участка");
  return decimal;
}

function optionalFullPaymentPrice(value: unknown) {
  if (value === undefined) return undefined;
  if (value === null || (typeof value === "string" && !value.trim()))
    return null;
  return positiveDecimal(value);
}

export function validateFullPaymentPrice(
  price: string,
  fullPaymentPrice: string | null | undefined,
) {
  if (
    fullPaymentPrice !== undefined &&
    fullPaymentPrice !== null &&
    !(Number(fullPaymentPrice) < Number(price))
  )
    throw new ValidationError(FULL_PAYMENT_PRICE_ERROR);
}

function cadastralNumber(value: unknown) {
  if (value === undefined) return undefined;
  const number = optionalText(value, PLOT_CADASTRAL_NUMBER_MAX_LENGTH);
  if (number !== null && !/^\d{2}:\d{2}:\d{6,7}:\d{1,10}$/.test(number))
    throw new ValidationError("Некорректный кадастровый номер");
  return number;
}

function optionalBoolean(value: unknown) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean")
    throw new ValidationError("Некорректное значение отметки документа");
  return value;
}

function mortgageUrl(value: unknown) {
  if (value === undefined) return undefined;
  const text = optionalText(value, PLOT_MORTGAGE_URL_MAX_LENGTH);
  if (text === null) return null;
  try {
    const url = new URL(text);
    if (
      url.protocol === "https:" &&
      /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*domclick\.ru$/.test(
        url.hostname,
      ) &&
      !url.username &&
      !url.password &&
      !url.port &&
      url.href.length <= PLOT_MORTGAGE_URL_MAX_LENGTH
    )
      return url.href;
  } catch {
    // Invalid URLs receive the same validation error as disallowed hosts.
  }
  throw new ValidationError("Укажите HTTPS-ссылку на объявление Домклик");
}

export function validatePlotUpdate(body: Record<string, unknown>): PlotUpdate {
  if (
    typeof body.status !== "string" ||
    !allowedStatuses.has(body.status as PlotStatus)
  )
    throw new ValidationError("Некорректный статус участка");
  const plot: PlotUpdate = {
    area: positiveDecimal(body.area),
    status: body.status as PlotStatus,
    price: positiveDecimal(body.price),
    fullPaymentPrice: optionalFullPaymentPrice(body.fullPaymentPrice),
    street:
      body.street === undefined
        ? undefined
        : optionalText(body.street, PLOT_STREET_MAX_LENGTH),
    description:
      body.description === undefined
        ? undefined
        : optionalText(body.description, PLOT_DESCRIPTION_MAX_LENGTH),
    cadastralNumber: cadastralNumber(body.cadastralNumber),
    gpzuDone: optionalBoolean(body.gpzuDone),
    buildingPermitDone: optionalBoolean(body.buildingPermitDone),
    mortgageUrl: mortgageUrl(body.mortgageUrl),
  };
  validateFullPaymentPrice(plot.price, plot.fullPaymentPrice);
  return plot;
}
