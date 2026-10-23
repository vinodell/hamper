import { preload } from "react-dom";
import { ArrowDown } from "lucide-react";
import { chooseZemli, heroFacts } from "../lib";

import "./AboutUs.css";

export const AboutUs = () => {
  preload(`${import.meta.env.BASE_URL}images/projects/home-hero.jpg`, {
    as: "image",
    fetchPriority: "high",
  });

  return (
    <section className="hero" id="top">
      <div className="hero-inner container">
        <p className="eyebrow light">КОМФОРТ-КЛАСС</p>
        <h1 className="my-text-bold">
          Мини-посёлки
          <br />
          <em>Хампер village</em>
        </h1>
        <p className="hero-copy my-text-bold">
          Надёжный девелопер с 5-летней историей. Новый камерный посёлок
          комфорт-класса
        </p>
        <div className="hero-facts">
          {heroFacts.map(({ icon: Icon, text }) => (
            <div className="hero-fact" key={text}>
              <span>
                <Icon size="1.25rem" />
              </span>
              <strong>{text}</strong>
            </div>
          ))}
        </div>
        <div className="hero-actions">
          <a className="button button-gold" href="#poselki">
            {chooseZemli}
          </a>
          <a className="button button-outline" href="#form">
            Записаться на просмотр <ArrowDown size="1.0625rem" />
          </a>
        </div>
      </div>
    </section>
  );
};
