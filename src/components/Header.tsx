import { Menu, Phone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
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

import "./Header.css";

export const Header = () => {
  const menu = useMobileMenu();
  const { pathname } = useLocation();
  const headerRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const projectsRef = useRef<HTMLDivElement>(null);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const plotTarget = pathname.startsWith("/projects/")
    ? `${pathname}#uchastki`
    : "/#poselki";

  const handleNavigation = useCallback(() => {
    menu.close();
    setProjectsOpen(false);
  }, [menu.close]);

  useEffect(() => {
    handleNavigation();
  }, [pathname, handleNavigation]);

  useEffect(() => {
    if (!menu.isOpen && !projectsOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleNavigation();
        if (menu.isOpen) toggleRef.current?.focus();
        else projectsRef.current?.querySelector("button")?.focus();
      }

      if (event.key !== "Tab" || !menu.isOpen) return;
      const controls = Array.from(
        headerRef.current?.querySelectorAll<HTMLElement>("a[href], button") ??
          [],
      ).filter((element) => element.getClientRects().length > 0);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    const handleOutsideClick = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !projectsRef.current?.contains(event.target)
      ) {
        setProjectsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("pointerdown", handleOutsideClick);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("pointerdown", handleOutsideClick);
    };
  }, [handleNavigation, menu.isOpen, projectsOpen]);

  useEffect(() => {
    if (menu.isOpen) {
      headerRef.current
        ?.querySelector<HTMLElement>(".main-nav button, .main-nav a")
        ?.focus();
    }
  }, [menu.isOpen]);

  const handleMenuToggle = useCallback(() => {
    setProjectsOpen(false);
    menu.toggle();
  }, [menu.toggle]);

  return (
    <header className="site-header" ref={headerRef}>
      <Link
        className="brand"
        aria-label="Hamper — главная"
        to="/"
        onClick={handleNavigation}
      >
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
            <div className="projects-menu" key={href} ref={projectsRef}>
              <button
                className="projects-trigger"
                type="button"
                aria-expanded={projectsOpen}
                aria-controls="projects-navigation"
                onClick={() => setProjectsOpen((open) => !open)}
              >
                {label} <span aria-hidden="true">⌄</span>
              </button>
              <div
                id="projects-navigation"
                hidden={!projectsOpen}
                className={`projects-dropdown ${projectsOpen ? "is-open" : ""}`}
              >
                {projectRoutes.map((project) => (
                  <Link
                    key={project.path}
                    to={project.path}
                    onClick={handleNavigation}
                  >
                    {project.label}
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <Link
              key={`${label}-${href}`}
              to={`${pathname}${href}`}
              onClick={handleNavigation}
            >
              {label}
            </Link>
          ),
        )}
        <a
          className="mobile-phone"
          href={siteConfig.phoneHref}
          onClick={handleNavigation}
        >
          <Phone size="1.0625rem" /> {siteConfig.phone}
        </a>
      </nav>
      <div className="header-contact">
        <Phone className="phone-icon" size="1.1875rem" aria-hidden="true" />
        <div className="telephones">
          <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
          <a href={siteConfig.phone2Href}>{siteConfig.phone2}</a>
          <span>{siteConfig.hours}</span>
        </div>
      </div>
      <Link
        className="button button-gold header-cta"
        to={plotTarget}
        onClick={handleNavigation}
      >
        {chooseZemli}
      </Link>
      <button
        className="menu-toggle"
        ref={toggleRef}
        type="button"
        aria-expanded={menu.isOpen}
        aria-controls="main-navigation"
        aria-label={menu.isOpen ? closeMenuMsg : openMenuMsg}
        onClick={handleMenuToggle}
      >
        {menu.isOpen ? <X size="1.5rem" /> : <Menu size="1.5rem" />}
      </button>
    </header>
  );
};
