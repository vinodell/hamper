import { Link } from "react-router-dom";
import { Brand } from "./Brand";
import { homeNavigation, navigation, offertaMsg, siteConfig } from "../lib";

import "./Footer.css";

export const Footer = ({
  variant = "default",
}: {
  variant?: "default" | "landing";
}) => {
  const isLanding = variant === "landing";
  return (
    <footer className="footer">
      <div className="container footer-top">
        <Brand className="brand-footer" />
        <div className="footer-links">
          {(isLanding ? homeNavigation : navigation).map(([label, href]) => (
            <Link
              key={`${label}-${href}`}
              to={
                isLanding
                  ? `/${href}`
                  : label === "Проекты"
                    ? "/#poselki"
                    : href
              }
            >
              {label}
            </Link>
          ))}
        </div>
        {isLanding && (
          <span className="home-footer-copyright">
            {siteConfig.copyright}. Все права защищены.
          </span>
        )}
      </div>
      <div className="container footer-bottom">
        {!isLanding && <span>{siteConfig.copyright}</span>}
        <span>{offertaMsg}</span>
        <a href="#">Наверх ↑</a>
      </div>
    </footer>
  );
};
