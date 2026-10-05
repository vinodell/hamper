import "./LoadingIndicator.css";

type LoadingIndicatorProps = {
  label?: string;
  compact?: boolean;
};

export function LoadingIndicator({
  label = "Загружаем участки…",
  compact = false,
}: LoadingIndicatorProps) {
  return (
    <div
      className={`loading-indicator${compact ? " loading-indicator-compact" : ""}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="loading-indicator-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
