import { IndividualPlots } from "../sections/IndividualPlots";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Footer, Header } from "../components";
import { projectPageConfig, type Plot, type ProjectSlug } from "../lib";
import { Contacts, Info, GeneralPlan, Table } from "../sections";

import "./Main.css";

export const Main = () => {
  const { slug } = useParams<{ slug: string }>();
  const [selectedPlot, setSelectedPlot] = useState<Plot | null>(null);
  const config =
    slug && Object.hasOwn(projectPageConfig, slug)
      ? projectPageConfig[slug as ProjectSlug]
      : undefined;
  const handleSelectPlot = useCallback((plot: Plot) => {
    // Selecting the same parcel again must update a form edited since that click.
    setSelectedPlot({ ...plot });
  }, []);

  useEffect(() => {
    setSelectedPlot(null);
  }, [slug]);

  if (!config) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="app">
      <Header />
      <main>
        <section className="project-heading">
          <div className="container">
            <Link className="back-link" to="/">
              <ArrowLeft size="1.0625rem" /> Все проекты
            </Link>
            <p className="eyebrow">ПРОЕКТ HAMPER</p>
            <h1>{config.title}</h1>
          </div>
        </section>
        {slug === "drugie-uchastki" ? (
          <IndividualPlots onSelectPlot={handleSelectPlot} />
        ) : (
          <>
            <Info />
            <GeneralPlan onSelectPlot={handleSelectPlot} />
          </>
        )}
        <Table
          key={`table:${slug}`}
          sortable={slug === "drugie-uchastki"}
          initialFilter={config.plotFilter}
          onSelectPlot={handleSelectPlot}
        />
        <Contacts
          key={`contacts:${slug}`}
          selectedPlot={
            selectedPlot?.settlement === config.plotFilter ? selectedPlot : null
          }
        />
      </main>
      <Footer />
    </div>
  );
};
