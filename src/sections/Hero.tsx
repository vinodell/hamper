import { ArrowDown } from "lucide-react";
import { chooseZemli, heroFacts } from "../lib";

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero-inner container">
        <p className="eyebrow light">КОМФОРТ-КЛАСС</p>
        <h1>
          Мини-посёлки
          <br />
          <em>«У Пяти Холмов»</em>
        </h1>
        <p className="hero-copy">
          Надёжный девелопер с 10-летней историей представляет продолжение
          легендарного КП «Пять Холмов». Два новых камерных посёлка
          комфорт-класса.
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
}
