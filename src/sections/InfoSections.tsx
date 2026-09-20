import { ArrowUpRight } from "lucide-react";

import { advantages, infrastructure, utilities } from "../lib";

export function InfoSections() {
  return (
    <>
      {/* <section className="section section-cream">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">ОКРУЖЕНИЕ И ДОСТУПНОСТЬ</p>
            <h2>
              Массив Ойнелово — <em>22 км от КАД</em>
            </h2>
          </div>
          <div className="feature-grid">
            {advantages.map(({ icon: Icon, title, text }) => (
              <article className="feature" key={title}>
                <span className="feature-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section> */}
      <section className="section-paper">
        <div className="container">
          <div className="section-heading centered">
            <p className="eyebrow">ИНФРАСТРУКТУРА РАЙОНА</p>
            <h2>
              Всё необходимое для
              <br />
              <em>жизни и отдыха рядом</em>
            </h2>
          </div>
          <div className="feature-grid three">
            {infrastructure.map(({ icon: Icon, title, text }) => (
              <article className="feature bordered" key={title}>
                <span className="feature-icon">
                  <Icon />
                </span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="utilities">
        <div className="container utilities-inner">
          <div>
            <p className="eyebrow light">КОММУНИКАЦИИ</p>
            <h2>
              Внутренняя инфраструктура <em>посёлков</em>
            </h2>
            <p>
              Всё необходимое для автономной и безопасной жизни в собственном
              доме.
            </p>
          </div>
          <div className="utility-grid">
            {utilities.map(({ icon: Icon, title, text }) => (
              <div className="utility" key={title}>
                <Icon />
                <div>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
