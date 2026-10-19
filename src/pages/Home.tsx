import { Footer, Header } from "../components";
import { PromotionBanner } from "../components/PromotionBanner";
import { Contacts } from "../sections/Contacts";
import { Projects } from "../sections/Projects";
import { AboutUs } from "../sections/AboutUs";

export const Home = () => {
  return (
    <div className="app">
      <Header />
      <main>
        <AboutUs />
        <PromotionBanner />
        <Projects />
        <Contacts />
      </main>
      <Footer />
    </div>
  );
};
