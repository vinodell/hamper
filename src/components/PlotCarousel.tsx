import { useCallback, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import type { PlotPhoto } from "../data/individualPlots";
import "./PlotCarousel.css";

function photoUrl(src: string) {
  return /^(https?:\/\/|data:)/.test(src)
    ? src
    : `${import.meta.env.BASE_URL}${src.replace(/^\//, "")}`;
}

function Slide({ photo }: { photo: PlotPhoto }) {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  return (
    <div className="plot-carousel-slide" aria-busy={state === "loading"}>
      {state === "loading" && (
        <span className="plot-carousel-message" role="status">
          Загружаем фотографию…
        </span>
      )}
      {state === "error" ? (
        <span className="plot-carousel-message" role="status">
          <ImageOff size="1.5rem" aria-hidden="true" />
          Не удалось загрузить фотографию
        </span>
      ) : (
        <img
          src={photoUrl(photo.src)}
          alt={photo.alt}
          decoding="async"
          className={state === "ready" ? "is-ready" : ""}
          onLoad={() => setState("ready")}
          onError={() => setState("error")}
        />
      )}
    </div>
  );
}

export function PlotCarousel({
  photos,
  title,
}: {
  photos: PlotPhoto[];
  title: string;
}) {
  const [index, setIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const currentIndex = Math.min(index, Math.max(0, photos.length - 1));
  const move = useCallback(
    (step: number) => {
      if (photos.length < 2) return;
      setIndex((current) => {
        const bounded = Math.min(current, photos.length - 1);
        return (bounded + step + photos.length) % photos.length;
      });
    },
    [photos.length],
  );

  if (!photos.length)
    return (
      <div className="plot-carousel-empty">
        <ImageOff size="2rem" aria-hidden="true" />
        <p>Фотографии этого участка скоро появятся.</p>
      </div>
    );

  return (
    <div
      className="plot-carousel"
      role="region"
      aria-roledescription="карусель"
      aria-label={`Фотографии: ${title}`}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          move(event.key === "ArrowLeft" ? -1 : 1);
        }
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (!touch || event.touches.length !== 1) {
          touchStart.current = null;
          return;
        }
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        touchStart.current = null;
        if (!start) return;
        const touch = event.changedTouches[0];
        if (!touch) return;
        const dx = touch.clientX - start.x;
        if (
          Math.abs(dx) > 50 &&
          Math.abs(dx) > Math.abs(touch.clientY - start.y)
        )
          move(dx < 0 ? 1 : -1);
      }}
    >
      <Slide key={photos[currentIndex].src} photo={photos[currentIndex]} />
      <div className="plot-carousel-controls">
        <button
          type="button"
          onClick={() => move(-1)}
          disabled={photos.length < 2}
          aria-label="Предыдущая фотография"
        >
          <ChevronLeft size="1.5rem" aria-hidden="true" />
        </button>
        <span aria-live="polite" aria-atomic="true">
          {currentIndex + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={() => move(1)}
          disabled={photos.length < 2}
          aria-label="Следующая фотография"
        >
          <ChevronRight size="1.5rem" aria-hidden="true" />
        </button>
      </div>
      {photos.length > 1 && (
        <div className="plot-carousel-pagination" aria-label="Выбор фотографии">
          {photos.map((photo, photoIndex) => (
            <button
              key={`${photo.src}-${photoIndex}`}
              type="button"
              aria-label={`Фотография ${photoIndex + 1}`}
              aria-current={photoIndex === currentIndex ? "true" : undefined}
              onClick={() => setIndex(photoIndex)}
            >
              <span />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
