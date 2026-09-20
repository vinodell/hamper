import { Footer, Header } from "../components";
import { siteConfig } from "../lib";
import { ContactSection, FormatSection, Hero } from "../sections";

export function HomePage() {
  return (
    <div className="app">
      <Header />
      <main>
        <Hero />
        <div className="ticker" aria-label="Акция">
          <div>
            {siteConfig.ticker} <b>•</b> {siteConfig.ticker} <b>•</b>{" "}
            {siteConfig.ticker} <b>•</b> {siteConfig.ticker}
          </div>
        </div>
        <FormatSection />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
