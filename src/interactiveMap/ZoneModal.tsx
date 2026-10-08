import { useEffect, useId, useRef } from "react";

import type { ZoneModalProps } from "./Interactive.types";
import { formatZonePrice, zoneStatusLabels } from "./zonePresentation";

import styles from "./ZoneModal.module.css";

export function ZoneModal({ zone, onClose }: ZoneModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    dialog.showModal();
    return () => dialog.close();
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
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.modalContent}>
        <button
          type="button"
          className={styles.modalClose}
          onClick={onClose}
          aria-label="Закрыть информацию об участке"
        >
          <span aria-hidden="true">×</span>
        </button>

        <div className={styles.modalHeader}>
          <span className={styles.modalEyebrow}>Участок {zone.number}</span>

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

              <strong className={styles.modalDetailValue}>
                {formatZonePrice(zone.price)}
              </strong>
            </div>
          )}
        </div>

        {zone.description && (
          <p id={descriptionId} className={styles.modalDescription}>
            {zone.description}
          </p>
        )}

        <div className={styles.modalActions}>
          {zone.status === "available" && (
            <a className={styles.primaryButton} href="#form" onClick={onClose}>
              Оставить заявку
            </a>
          )}

          <button
            type="button"
            className={styles.secondaryButton}
            onClick={onClose}
          >
            Закрыть
          </button>
        </div>
      </div>
    </dialog>
  );
}
