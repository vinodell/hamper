import { useEffect, useId, useRef } from "react";
import { ArrowUpRight, BellRing, House } from "lucide-react";

import { PlotDocuments } from "../components/PlotDetailsContent";
import { PlotPrice } from "../components/PlotPrice";
import type { ZoneModalProps } from "./Interactive.types";
import { zoneStatusLabels } from "./zonePresentation";

import styles from "./ZoneModal.module.css";

export function ZoneModal({ zone, onClose, onBook, onNotify }: ZoneModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousScrollbarGutter =
      document.documentElement.style.scrollbarGutter;
    document.body.style.overflow = "hidden";
    document.documentElement.style.scrollbarGutter = "stable";
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.scrollbarGutter = previousScrollbarGutter;
      if (
        (previousFocus instanceof HTMLElement ||
          previousFocus instanceof SVGElement) &&
        previousFocus.isConnected
      )
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={styles.modal}
      aria-labelledby={titleId}
      aria-describedby={zone.description ? descriptionId : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className={styles.modalContent}>
        <div
          className={styles.modalToolbar}
          data-notification={zone.status === "reserved"}
        >
          {zone.status === "reserved" && (
            <a
              className={`${styles.secondaryButton} ${styles.notificationButton}`}
              href="#form"
              aria-label={`Уведомить об освобождении участка ${zone.plotId}`}
              aria-haspopup={onNotify ? "dialog" : undefined}
              onClick={(event) => {
                if (onNotify) event.preventDefault();
                onClose();
                onNotify?.();
              }}
            >
              <BellRing
                className={styles.notificationBell}
                size={18}
                aria-hidden="true"
              />
              <span>Уведомить, если участок освободится</span>
            </a>
          )}
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label="Закрыть информацию об участке"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        <div className={styles.modalHeader}>
          <h2 id={titleId} className={styles.modalTitle}>
            {zone.title}
          </h2>
          <span className={styles.status} data-status={zone.status}>
            {zoneStatusLabels[zone.status]}
          </span>
        </div>

        <div className={styles.modalDetails}>
          {zone.area !== undefined && (
            <div className={styles.modalDetail}>
              <span className={styles.modalDetailLabel}>Площадь</span>

              <strong className={styles.modalDetailValue}>
                {zone.area.toLocaleString("ru-RU")} сот.
              </strong>
            </div>
          )}

          {zone.price !== undefined && (
            <div className={styles.modalDetail}>
              <span className={styles.modalDetailLabel}>Стоимость</span>

              <PlotPrice
                className={styles.modalDetailValue}
                price={zone.price}
                fullPaymentPrice={zone.fullPaymentPrice}
              />
            </div>
          )}
        </div>

        <PlotDocuments
          cadastralNumber={zone.cadastralNumber}
          gpzuDone={zone.gpzuDone}
          buildingPermitDone={zone.buildingPermitDone}
        />

        {zone.description && (
          <p id={descriptionId} className={styles.modalDescription}>
            {zone.description}
          </p>
        )}

        {zone.status === "available" && (
          <div className={styles.modalActions}>
            {zone.status === "available" && (
              <a
                className={styles.primaryButton}
                href="#form"
                onClick={(event) => {
                  if (onBook) event.preventDefault();
                  onClose();
                  onBook?.();
                }}
              >
                Забронировать участок
              </a>
            )}

            {zone.status === "available" && zone.mortgageUrl && (
              <a
                className={`${styles.mortgageButton} tw:motion-safe:transition tw:motion-safe:duration-200`}
                href={zone.mortgageUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Купить в ипотеку: участок ${zone.number} на Домклик (откроется в новой вкладке)`}
              >
                <span className={styles.mortgageIcon} aria-hidden="true">
                  <House size={22} strokeWidth={1.75} />
                </span>
                <span className={styles.mortgageCopy}>
                  <span>Купить в ипотеку</span>
                  <span className={styles.mortgageCaption}>
                    Объявление на Домклик
                  </span>
                </span>
                <ArrowUpRight
                  className={styles.mortgageArrow}
                  size={18}
                  aria-hidden="true"
                />
              </a>
            )}
          </div>
        )}
      </div>
    </dialog>
  );
}
