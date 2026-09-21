import { Logo } from "../images";
import { navigation, offertaMsg, siteConfig } from "../lib";

export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-top">
        <a className="brand brand-footer" href="#top">
          <Logo />
          <span className="brand-name">
            {siteConfig.brand}
            <small>{siteConfig.brandSubtitle}</small>
          </span>
        </a>
        <div className="footer-links">
          {navigation.map(([label, href]) => (
              <a key={`${label}-${href}`} href={href}>
              {label}
            </a>
          ))}
        </div>
      </div>
      <div className="container footer-bottom">
        <span>{siteConfig.copyright}</span>
        <span>{offertaMsg}</span>
        <a href="#top">Наверх ↑</a>
      </div>
    </footer>
  );
}
