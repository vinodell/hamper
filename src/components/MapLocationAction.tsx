import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { Check, LocateFixed, Navigation } from "lucide-react";
import type { MapDestination } from "../lib/constants";

import "./MapLocationAction.css";

const mobileQuery = "(max-width: 47.5rem)";
const subscribeToViewport = (notify: () => void) => {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const isMobileViewport = () => window.matchMedia(mobileQuery).matches;

export function MapLocationAction({ location }: { location: MapDestination }) {
  const mobile = useSyncExternalStore(
    subscribeToViewport,
    isMobileViewport,
    () => false,
  );
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "error">(
    "idle",
  );
  const messageId = useId();
  const coordinates = location.coordinates.trim();
  const navigatorUrl = location.navigatorUrl.trim();

  useEffect(() => {
    if (status !== "copied") return;
    const timer = window.setTimeout(() => setStatus("idle"), 4000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copyCoordinates = async () => {
    if (!coordinates || status === "copying") return;
    setStatus("copying");
    try {
      if (!navigator.clipboard?.writeText)
        throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(coordinates);
      setStatus("copied");
    } catch {
      setStatus("error");
    }
  };

  if (mobile) {
    const label = "Открыть маршрут в Яндекс Навигаторе";
    return (
      <div className="map-location-action">
        {navigatorUrl ? (
          <a
            className="map-location-action__button"
            href={navigatorUrl}
            aria-label={label}
            title={label}
          >
            <span className="map-location-action__icon">
              <Navigation size={19} aria-hidden="true" />
            </span>
            <span>Открыть маршрут</span>
          </a>
        ) : (
          <>
            <button
              className="map-location-action__button"
              type="button"
              aria-label={label}
              title="Ссылка на маршрут пока не добавлена"
              disabled
            >
              <span className="map-location-action__icon">
                <Navigation size={19} aria-hidden="true" />
              </span>
              <span>Открыть маршрут</span>
            </button>
            <span className="map-location-action__message">
              Маршрут скоро появится
            </span>
          </>
        )}
      </div>
    );
  }

  const message =
    status === "copied"
      ? "Координаты до массива скопированы в буфер обмена"
      : status === "error"
        ? `Не удалось скопировать координаты. Скопируйте их вручную: ${coordinates}`
        : !coordinates
          ? "Координаты скоро появятся"
          : "";

  return (
    <div className="map-location-action">
      <button
        className="map-location-action__button"
        type="button"
        data-status={status}
        aria-label="Скопировать координаты массива"
        aria-describedby={message ? messageId : undefined}
        aria-busy={status === "copying"}
        title={
          coordinates
            ? "Скопировать координаты массива"
            : "Координаты массива пока не добавлены"
        }
        disabled={!coordinates || status === "copying"}
        onClick={() => void copyCoordinates()}
      >
        <span className="map-location-action__icon">
          {status === "copied" ? (
            <Check size={20} aria-hidden="true" />
          ) : (
            <LocateFixed size={20} aria-hidden="true" />
          )}
        </span>
        <span>Скопировать координаты</span>
      </button>
      <span
        id={messageId}
        className="map-location-action__message"
        data-error={status === "error"}
        role="status"
      >
        {message}
      </span>
    </div>
  );
}
