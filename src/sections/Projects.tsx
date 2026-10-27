import { ArrowRight, ArrowUpRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { projectRoutes } from "../lib";

const projects = [
  {
    route: projectRoutes[0],
    image: "oinelovo-meadow-960.webp",
    imageAlt: "Лес и зелёные луга в тёплом вечернем свете",
    tag: "Камерный посёлок",
    copy: "Место для спокойной жизни в окружении природы. Всего в 25 км от КАД.",
  },
  {
    route: projectRoutes[1],
    image: "home-960.webp",
    imageAlt: "Лес и озеро в вечернем свете",
    tag: "Индивидуальные предложения",
    copy: "Подборка участков в живописных локациях Ленинградской области.",
  },
];

export function Projects() {
  return (
    <section
      className="home-projects"
      id="poselki"
      aria-labelledby="home-projects-title"
    >
      <div className="container">
        <div className="home-section-heading">
          <div>
            <h2 id="home-projects-title">Актуальные проекты</h2>
          </div>
          <a className="home-text-link" href="#home-project-list">
            Все проекты <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
        <div className="home-project-grid" id="home-project-list">
          {projects.map(({ route, image, imageAlt, tag, copy }) => (
            <article className="home-project-card" key={route.path}>
              <Link
                className="home-project-card__image"
                to={route.path}
                aria-label={`Посмотреть проект «${route.label}»`}
              >
                <img
                  src={`${import.meta.env.BASE_URL}images/nature/${image}`}
                  alt={imageAlt}
                  width={960}
                  height={384}
                  loading="lazy"
                  decoding="async"
                />
                <span className="home-project-card__tag">{tag}</span>
                <span
                  className="home-project-card__image-arrow"
                  aria-hidden="true"
                >
                  <ArrowUpRight size={24} />
                </span>
              </Link>
              <div className="home-project-card__content">
                <h3>
                  <Link to={route.path}>{route.label}</Link>
                </h3>
                <p className="home-project-card__location">
                  <MapPin size={15} strokeWidth={1.6} aria-hidden="true" />
                  Ленинградская область
                </p>
                <div className="home-project-card__bottom">
                  <p>{copy}</p>
                  <Link
                    className="home-button home-button--primary home-button--small"
                    to={route.path}
                  >
                    Подробнее <ArrowUpRight size={16} aria-hidden="true" />
                    <span className="home-sr-only">
                      {" "}
                      о проекте «{route.label}»
                    </span>
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
