import { Logo } from "../images";
import { Link, useLocation } from "react-router-dom";
import { navigation, offertaMsg, siteConfig } from "../lib";

import "./Footer.css";

export const Footer = () => {
  const { pathname } = useLocation();
  const projectsHref = pathname === "/" ? "#poselki" : "/#poselki";

  return (
    <footer className="footer">
      <div className="container footer-top">
        <Link
          className="brand brand-footer"
          to="/"
          aria-label="Hamper — главная"
        >
          <Logo />
          <span className="brand-name">
            {siteConfig.brand}
            <small>{siteConfig.brandSubtitle}</small>
          </span>
        </Link>
        <div className="footer-links">
          {navigation.map(([label, href]) => (
            <Link
              key={`${label}-${href}`}
              to={label === "Проекты" ? projectsHref : href}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>
      <div className="container footer-bottom">
        <span>{siteConfig.copyright}</span>
        <span>{offertaMsg}</span>
        <a href="#">Наверх ↑</a>
      </div>
    </footer>
  );
};
