import { useEffect, useId, useRef, MouseEvent } from "react";

import type { ZoneModalProps, ZoneStatus } from "./Interactive.types";

import styles from "./ZoneModal.module.css";

const formatPrice = (price: number): string =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(price);

const getStatusLabel = (status: ZoneStatus): string => {
  switch (status) {
    case "available":
      return "Свободен";

    case "reserved":
      return "Забронирован";

    case "sold":
      return "Продан";

    case "unknown":
    default:
      return "Статус уточняется";
  }
};

export function ZoneModal({ zone, onClose }: ZoneModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;

    if (!dialog) {
      return;
    }

    if (!dialog.open) {
      dialog.showModal();
    }

    return () => {
      if (dialog.open) {
        dialog.close();
      }
    };
  }, []);

  const handleBackdropClick = (event: MouseEvent<HTMLDialogElement>): void => {
    /**
     * Если кликнули именно по <dialog>,
     * а не по содержимому внутри —
     * значит пользователь нажал на backdrop.
     */
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

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
      onClick={handleBackdropClick}
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
            {getStatusLabel(zone.status)}
          </span>
        </div>

        <div className={styles.modalDetails}>
          {zone.area !== undefined && (
            <div className={styles.modalDetail}>
              <span className={styles.modalDetailLabel}>Площадь</span>

              <strong className={styles.modalDetailValue}>
                {zone.area} сот.
              </strong>
            </div>
          )}

          {zone.price !== undefined && (
            <div className={styles.modalDetail}>
              <span className={styles.modalDetailLabel}>Стоимость</span>

              <strong className={styles.modalDetailValue}>
                {formatPrice(zone.price)}
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
          {zone.status !== "sold" && (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                /**
                 * Здесь можно:
                 *
                 * - открыть форму;
                 * - перейти к заявке;
                 * - вызвать callback;
                 * - отправить событие аналитики.
                 */
                console.log("Request zone:", zone.id);
              }}
            >
              Оставить заявку
            </button>
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
