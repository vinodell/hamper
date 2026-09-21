import { settlementFormats } from "../lib";
import { Link } from "react-router-dom";
import { projectRoutes } from "../lib";

export function FormatSection() {
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
              <div
                className="format-image"
                style={{ backgroundImage: `url(${format.image})` }}
              >
                <span>{format.label}</span>
              </div>
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
}
