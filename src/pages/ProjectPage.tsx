import { ArrowLeft } from "lucide-react";
import { useState } from 'react';
import { Link, Navigate, useParams } from "react-router-dom";
import { Footer, Header } from "../components";
import { projectPageConfig, type ProjectSlug } from "../lib";
import { ContactSection, InfoSections, MasterplanSection, PlotsSection } from "../sections";

export function ProjectPage() {
  const [selectedProject, setSelectedProject] = useState<string>("");
  const { slug } = useParams<{ slug: string }>();
  const config = slug && projectPageConfig[slug as ProjectSlug];

  if (!config) {
    return <Navigate to="/" replace />;
  }

  console.log('selectedProject', selectedProject)

  return (
    <div className="app">
      <Header />
      <main>
        <section className="project-heading">
          <div className="container">
            <Link className="back-link" to="/">
              <ArrowLeft size={17} /> Все проекты
            </Link>
            <p className="eyebrow">ПРОЕКТ HAMPER</p>
            <h1>{config.title}</h1>
          </div>
        </section>
        <InfoSections />
        <MasterplanSection selectedPlan={config.formatIndex} />
        <PlotsSection initialFilter={config.plotFilter} />
        <ContactSection />
      </main>
      <Footer />
    </div>
  );
}
