import { ArrowLeft } from "lucide-react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Footer, Header } from "../components";
import { projectPageConfig, type ProjectSlug } from "../lib";
import { Contacts } from "../sections/Contacts";
import { Info } from "../sections/Info";
import { InteractiveMap } from "../sections/InteractiveMap";
import { Table } from "../sections/Table";

export function Main() {
  const { slug } = useParams<{ slug: string }>();
  const config = slug && projectPageConfig[slug as ProjectSlug];

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
              <ArrowLeft size={17} /> Все проекты
            </Link>
            <p className="eyebrow">ПРОЕКТ HAMPER</p>
            <h1>{config.title}</h1>
          </div>
        </section>
        <Info />
        <InteractiveMap selectedPlan={config.formatIndex} />
        <Table initialFilter={config.plotFilter} />
        <Contacts />
      </main>
      <Footer />
    </div>
  );
}
