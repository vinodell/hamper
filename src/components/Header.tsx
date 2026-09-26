import { Menu, Phone, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useMobileMenu } from "../hooks";
import { Logo } from "../images";
import {
  chooseZemli,
  closeMenuMsg,
  navigation,
  openMenuMsg,
  projectRoutes,
  siteConfig,
} from "../lib";

export const Header = () => {
  const menu = useMobileMenu();
  const [projectsOpen, setProjectsOpen] = useState(false);

  const handleProjectNavigation = () => {
    menu.close();
    setProjectsOpen(false);
  };

  return (
    <header className="site-header">
      <Link className="brand" aria-label="Hamper — главная" to="/" onClick={handleProjectNavigation}>
        <Logo />
        <span className="brand-name">
          {siteConfig.brand}
          <small>{siteConfig.brandSubtitle}</small>
        </span>
      </Link>
      <nav
        id="main-navigation"
        className={`main-nav ${menu.isOpen ? "is-open" : ""}`}
        aria-label="Основная навигация"
      >
        {navigation.map(([label, href]) =>
          label === "Проекты" ? (
            <div className="projects-menu" key={href}>
              <button
                className="projects-trigger"
                type="button"
                aria-expanded={projectsOpen}
                onClick={() => setProjectsOpen((open) => !open)}
              >
                {label} <span aria-hidden="true">⌄</span>
              </button>
              <div
                className={`projects-dropdown ${projectsOpen ? "is-open" : ""}`}
              >
                {projectRoutes.map((project) => (
                  <Link
                    key={project.path}
                    to={project.path}
                    onClick={handleProjectNavigation}
                  >
                    {project.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <a key={`${label}-${href}`} href={href} onClick={menu.close}>
              {label}
            </a>
          ),
        )}
        <a className="mobile-phone" href={siteConfig.phoneHref}>
          <Phone size={17} /> {siteConfig.phone}
        </a>
        <a
          className="button button-dark mobile-cta"
          href="#poselki"
          onClick={menu.close}
        >
          {chooseZemli}
        </a>
      </nav>
      <div className="header-contact">
        <Phone className="phone-icon" size={19} aria-hidden="true" />
        <div className="telephones">
          <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
          <a href={siteConfig.phoneHref}>{siteConfig.phone2}</a>
          <span>{siteConfig.hours}</span>
        </div>
      </div>
      <a className="button button-gold header-cta" href="#poselki">
        {chooseZemli}
      </a>
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={menu.isOpen}
        aria-controls="main-navigation"
        aria-label={menu.isOpen ? closeMenuMsg : openMenuMsg}
        onClick={menu.toggle}
      >
        {menu.isOpen ? <X /> : <Menu />}
      </button>
    </header>
  );
};
