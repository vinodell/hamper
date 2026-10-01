import { useState } from "react";
import { Link } from "react-router-dom";
import { settlementFormats, projectRoutes } from "../lib";

import "./Projects.css";

const ProjectImage = ({ src, alt, label }: { src: string; alt: string; label: string }) => {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className={`format-image ${loaded ? "is-loaded" : ""}`}>
      {!loaded && <div className="format-image-skeleton" aria-hidden="true" />}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={loaded ? "is-loaded" : ""}
      />
      <span>{label}</span>
    </div>
  );
};

export const Projects = () => {
  return (
    <section className="section section-paper" id="poselki">
      <div className="container">
        <div className="section-heading narrow">
          <p className="eyebrow">ФОРМАТЫ ПРОЖИВАНИЯ</p>
          <h2 className="my-text-bold">
            Наши проекты —<br />
            <em>выберите подходящий формат</em>
          </h2>
        </div>
        <div className="format-grid">
          {settlementFormats.map((format, index) => (
            <article className="format-card" key={format.title}>
              <ProjectImage src={format.image} alt={format.title} label={format.label} />
              <div className="format-content">
                <h3>{format.title}</h3>
                <p>{format.copy}</p>
                <ul>
                  {format.facts.map(({ text, icon: Icon }) => (
                    <li key={text}>
                      <Icon size={17} />
                      {text}
                    </li>
                  ))}
                </ul>
                <Link className="text-link" to={projectRoutes[index].path}>
                  Смотреть генплан <span>↗</span>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};
