import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Footer, Header } from "../components";
import { ProjectDialog } from "../components/ProjectDialog";
import { PromotionBanner } from "../components/PromotionBanner";
import { Contacts } from "../sections/Contacts";
import { Projects } from "../sections/Projects";
import { AboutUs } from "../sections/AboutUs";
import { HomeHero } from "../sections/HomeHero";
import { HomeContacts } from "../sections/HomeContacts";

import "./Home.css";

export function Home() {
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const openInquiry = () => setInquiryOpen(true);

  return (
    <div className="app home-page">
      <Header variant="landing" onInquiry={openInquiry} />
      <main>
        <HomeHero />
        <PromotionBanner />
        <Projects />
        <AboutUs />
        <HomeContacts />
      </main>
      <Footer variant="landing" />
      {inquiryOpen && (
        <ProjectDialog
          title="Подберём ваш участок"
          className="home-inquiry"
          icon={<MessageCircle size={20} aria-hidden="true" />}
          closeDisabled={submitting}
          onClose={() => setInquiryOpen(false)}
        >
          <Contacts
            id="home-inquiry-form"
            variant="dialog"
            onSubmittingChange={setSubmitting}
          />
        </ProjectDialog>
      )}
    </div>
  );
}
