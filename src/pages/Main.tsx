import { lazy, useCallback, useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { OinelovoHeader, OinelovoFooter } from "../components/OinelovoChrome";
import { ContactPeople } from "../components/ContactPeople";
import { ProjectDialog } from "../components/ProjectDialog";
import { siteConfig } from "../lib";
import { projectPageConfig, type Plot, type ProjectSlug } from "../lib";
import { Contacts } from "../sections/Contacts";
import { IndividualPlots } from "../sections/IndividualPlots";
import { Table } from "../sections/Table";

import "./Main.css";

const projectLinks = [
  ["Участки", "#uchastki"],
  ["Контакты", "#form"],
] as const;

const Oinelovo = lazy(() =>
  import("./Oinelovo").then((module) => ({ default: module.Oinelovo })),
);

export const Main = () => {
  const { slug } = useParams<{ slug: string }>();
  const [inquiryOpen, setInquiryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const config =
    slug && Object.hasOwn(projectPageConfig, slug)
      ? projectPageConfig[slug as ProjectSlug]
      : undefined;
  const handleSelectPlot = useCallback((plot: Plot) => {
    // Selecting the same parcel again must update a form edited since that click.
    setSelectedPlot({ ...plot });
    setInquiryOpen(true);
  }, []);

  useEffect(() => {
    setSelectedPlot(null);
    setInquiryOpen(false);
  }, [slug]);

  if (!config) {
    return <Navigate to="/" replace />;
  }

  if (slug === "oynelovskie-dali") return <Oinelovo />;

  return (
    <div className="app project-page project-typography">
      <OinelovoHeader
        links={projectLinks}
        onInquiry={() => setInquiryOpen(true)}
      />
      <main>
        <section className="project-heading">
          <img
            className="project-heading-image"
            src={`${import.meta.env.BASE_URL}images/nature/home-1920.webp`}
            srcSet={`${import.meta.env.BASE_URL}images/nature/home-960.webp 960w, ${import.meta.env.BASE_URL}images/nature/home-1920.webp 1920w`}
            sizes="100vw"
            width={1920}
            height={768}
            alt=""
            fetchPriority="high"
          />
          <div className="container">
            <h1>{config.title}</h1>
          </div>
        </section>
        <IndividualPlots onSelectPlot={handleSelectPlot} />
        <Table
          key={`table:${slug}`}
          sortable={slug === "drugie-uchastki"}
          initialFilter={config.plotFilter}
          onSelectPlot={handleSelectPlot}
        />
        <section
          className="project-contacts"
          id="form"
          aria-labelledby="project-contacts-title"
        >
          <div className="container project-contacts-grid">
            <div>
              <h2 id="project-contacts-title">
                Хотите узнать больше или записаться на просмотр?
              </h2>
              <p>Расскажем о свободных участках и ответим на ваши вопросы.</p>
              <button
                className="inquiry-button"
                type="button"
                onClick={() => setInquiryOpen(true)}
              >
                Оставить заявку
              </button>
            </div>
            <address className="project-contact-card project-contacts-card">
              <ContactPeople />
              <small>{siteConfig.hours}</small>
            </address>
          </div>
        </section>
      </main>
      <OinelovoFooter links={projectLinks} />
      {inquiryOpen && (
        <ProjectDialog
          title="Записаться на просмотр"
          className="contact-dialog"
          closeDisabled={submitting}
          onClose={() => setInquiryOpen(false)}
        >
          <Contacts
            key={`contacts:${slug}`}
            id="project-inquiry-form"
            variant="dialog"
            initialProject={config.plotFilter}
            selectedPlot={
              selectedPlot?.settlement === config.plotFilter
                ? selectedPlot
                : null
            }
            onSubmittingChange={setSubmitting}
          />
        </ProjectDialog>
      )}
    </div>
  );
};
