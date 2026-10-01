import { Footer, Header } from "../components";
import { siteConfig } from "../lib";
import { Contacts } from "../sections/Contacts";
import { Projects } from "../sections/Projects";
import { AboutUs } from "../sections/AboutUs";

import "./Home.css";

const tickerItems = Array.from({ length: 8 }, () => siteConfig.ticker);

export const Home = () => {
  return (
    <div className="app">
      <Header />
      <main>
        <AboutUs />
        <div className="ticker" aria-label="Акция">
          <div className="ticker-track" aria-hidden="true">
            {tickerItems.concat(tickerItems).map((item, index) => (
              <span className="ticker-item" key={`${item}-${index}`}>
                <span className="ticker-text">{item}</span>
                <span className="ticker-dot">✦</span>
              </span>
            ))}
          </div>
        </div>
        <Projects />
        <Contacts />
      </main>
      <Footer />
    </div>
  );
};
