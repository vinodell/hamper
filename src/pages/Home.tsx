import { Footer, Header } from "../components";
import { siteConfig } from "../lib";
import { Contacts } from "../sections/Contacts";
import { Projects } from "../sections/Projects";
import { AboutUs } from "../sections/AboutUs";

export function Home() {
  return (
    <div className="app">
      <Header />
      <main>
        <AboutUs />
        <div className="ticker" aria-label="Акция">
          <div>
            {siteConfig.ticker} <b>•</b> {siteConfig.ticker} <b>•</b>{" "}
            {siteConfig.ticker} <b>•</b> {siteConfig.ticker}
          </div>
        </div>
        <Projects />
        <Contacts />
      </main>
      <Footer />
    </div>
  );
}
