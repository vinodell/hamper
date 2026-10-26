import { CompletedProjects } from "../components/CompletedProjects";

export function AboutUs() {
  return (
    <section
      className="home-about"
      id="about-company"
      aria-labelledby="home-about-title"
    >
      <div className="container home-about__grid">
        <div className="home-about__copy">
          <h2 id="home-about-title">О компании</h2>
          <p>
            Хампер — это загородные мини-посёлки для тех, кто ищет комфорт и загородный уют.
          </p>
          <p>
            Мы развиваем небольшие камерные проекты в Ленинградской области, создавая
            пространство для спокойной жизни рядом с городом. Помогаем найти
            своё место — от первого знакомства с посёлком до покупки участка.
          </p>
        </div>
        <CompletedProjects />
      </div>
    </section>
  );
}
