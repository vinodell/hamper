import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import "./ProjectDialog.css";

type ProjectDialogProps = {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  closeDisabled?: boolean;
};

export const ProjectDialog = ({
  title,
  children,
  onClose,
  className,
  closeDisabled = false,
}: ProjectDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const previousScrollbarGutter =
      document.documentElement.style.scrollbarGutter;

    document.documentElement.style.scrollbarGutter = "stable";
    document.body.style.overflow = "hidden";
    dialog.showModal();

    return () => {
      if (dialog.open) dialog.close();
      document.body.style.overflow = previousOverflow;
      document.documentElement.style.scrollbarGutter = previousScrollbarGutter;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected)
        previousFocus.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className={`project-dialog${className ? ` ${className}` : ""}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      onClick={(event) => {
        if (closeDisabled) return;
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
      <div className="project-dialog__header">
        <h2 className="project-dialog__title" id={titleId}>
          {title}
        </h2>
        <button
          className="project-dialog__close"
          type="button"
          onClick={onClose}
          disabled={closeDisabled}
        >
          <X size="1.125rem" aria-hidden="true" />
          <span>Закрыть</span>
        </button>
      </div>
      <div className="project-dialog__body">{children}</div>
    </dialog>
  );
};
