import { ContactPeople } from "../components/ContactPeople";

export function HomeContacts() {
  return (
    <section
      className="home-contact-wrap"
      id="form"
      aria-labelledby="home-contact-title"
    >
      <div className="container home-contact">
        <div className="home-contact__content">
          <h2 id="home-contact-title">Хотите подобрать участок?</h2>
          <ContactPeople className="home-contact__people" />
        </div>
        <div className="home-contact__photo">
          <img
            src={`${import.meta.env.BASE_URL}images/nature/oinelovo-960.webp`}
            alt="Сосновый лес у тихого озера"
            width={960}
            height={384}
            loading="lazy"
            decoding="async"
          />
        </div>
      </div>
    </section>
  );
}
