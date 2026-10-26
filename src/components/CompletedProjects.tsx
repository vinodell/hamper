import { useState } from "react";
import { ArrowLeft, ArrowRight, Images, MapPin } from "lucide-react";
import { completedProjects } from "../data/completedProjects";

export function CompletedProjects() {
  const [index, setIndex] = useState(0);
  const project = completedProjects[index];
  if (!project) return null;

  const move = (step: number) => {
    setIndex(
      (current) =>
        (current + step + completedProjects.length) % completedProjects.length,
    );
  };

  return (
    <div
      className="completed-projects"
      role="region"
      aria-roledescription="карусель"
      aria-label="Завершённые проекты"
    >
      <div className="completed-projects__heading">
        <p className="home-kicker">Завершённые проекты</p>
        <span
          className="completed-projects__count"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {String(index + 1).padStart(2, "0")} /{" "}
          {String(completedProjects.length).padStart(2, "0")}
        </span>
      </div>
      <article className="completed-project" aria-label={project.title}>
        <div className="completed-project__image" key={project.id}>
          {project.image ? (
            <img
              src={`${import.meta.env.BASE_URL}${project.image}`}
              alt={project.title}
              width={1000}
              height={620}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="completed-project__placeholder">
              <Images size={32} strokeWidth={1.15} aria-hidden="true" />
              <span>Фотографии скоро</span>
            </div>
          )}
          <span className="completed-project__badge">Проект завершён</span>
          <span className="completed-project__number" aria-hidden="true">
            {project.id}
          </span>
        </div>
        <div className="completed-project__bottom">
          <div>
            <h3>{project.title}</h3>
            {project.location && (
              <p className="completed-project__location">
                <MapPin size={14} aria-hidden="true" />
                {project.location}
              </p>
            )}
            {project.description && <p>{project.description}</p>}
          </div>
          <div className="completed-projects__controls">
            <button
              className="tw:motion-safe:transition-transform tw:active:scale-95"
              type="button"
              aria-label="Предыдущий проект"
              onClick={() => move(-1)}
              disabled={completedProjects.length < 2}
            >
              <ArrowLeft size={19} aria-hidden="true" />
            </button>
            <button
              className="tw:motion-safe:transition-transform tw:active:scale-95"
              type="button"
              aria-label="Следующий проект"
              onClick={() => move(1)}
              disabled={completedProjects.length < 2}
            >
              <ArrowRight size={19} aria-hidden="true" />
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
