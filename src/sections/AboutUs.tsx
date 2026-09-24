import { ArrowDown } from "lucide-react";
import { chooseZemli, heroFacts } from "../lib";

export const AboutUs = () => {
  return (
    <section className="hero" id="top">
      <div className="hero-inner container">
        <p className="eyebrow light">КОМФОРТ-КЛАСС</p>
        <h1 className="my-text-bold">
          Мини-посёлки
          <br />
          <em>Hamper village</em>
        </h1>
        <p className="hero-copy my-text-bold">
          Надёжный девелопер с 5-летней историей. Новый камерный посёлок
          комфорт-класса
        </p>
        <div className="hero-facts">
          {heroFacts.map(({ icon: Icon, text }) => (
            <div className="hero-fact" key={text}>
              <span>
                <Icon size={20} />
              </span>
              <strong>{text}</strong>
            </div>
          ))}
        </div>
        <div className="hero-actions">
          <a className="button button-gold" href="#uchastki">
            {chooseZemli}
          </a>
          <a className="button button-outline" href="#form">
            Записаться на просмотр <ArrowDown size={17} />
          </a>
        </div>
      </div>
    </section>
  );
};
