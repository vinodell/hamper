import { Menu, Phone, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Brand } from "./Brand";
import { offertaMsg, siteConfig } from "../lib";

import "./OinelovoChrome.css";

const pageLinks = [
  ["Посёлки", "/#poselki"],
  ["О посёлке", "#about"],
  ["Преимущества", "#advantages"],
  ["Контакты", "#form"],
] as const;

interface OinelovoHeaderProps {
  onInquiry: () => void;
}

export function OinelovoHeader({ onInquiry }: OinelovoHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback((restoreFocus = false) => {
    setMenuOpen(false);
    if (restoreFocus) toggleRef.current?.focus();
  }, []);

  const handleInquiry = useCallback(() => {
    closeMenu();
    onInquiry();
  }, [closeMenu, onInquiry]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 64em)");
    const handleResize = () => {
      if (desktop.matches) closeMenu();
    };
    desktop.addEventListener("change", handleResize);
    return () => desktop.removeEventListener("change", handleResize);
  }, [closeMenu]);

  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    menuRef.current?.querySelector<HTMLElement>("a[href]")?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMenu(true);
        return;
      }
      if (event.key !== "Tab") return;

      const controls = Array.from(
        headerRef.current?.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])",
        ) ?? [],
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

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, closeMenu]);

  return (
    <header className="oinelovo-header" ref={headerRef}>
      <div className="oinelovo-container oinelovo-header__row">
        <Brand onClick={() => closeMenu()} />

        <nav
          className="oinelovo-header__desktop-nav"
          aria-label="Основная навигация"
        >
          {pageLinks.map(([label, href]) =>
            href.startsWith("/") ? (
              <Link key={href} to={href}>
                {label}
              </Link>
            ) : (
              <a key={href} href={href}>
                {label}
              </a>
            ),
          )}
        </nav>

        {(siteConfig.phone || siteConfig.phone2) && (
          <div className="oinelovo-header__phones">
            <Phone size="1rem" aria-hidden="true" />
            <div>
              {siteConfig.phone && (
                <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
              )}
              {siteConfig.phone2 && (
                <a href={siteConfig.phone2Href}>{siteConfig.phone2}</a>
              )}
            </div>
          </div>
        )}

        <button
          className="oinelovo-header__inquiry"
          type="button"
          onClick={handleInquiry}
        >
          <span className="oinelovo-header__inquiry-label-desktop">
            Оставить заявку
          </span>
          <span className="oinelovo-header__inquiry-label-mobile">Заявка</span>
        </button>

        <button
          className="oinelovo-header__toggle"
          ref={toggleRef}
          type="button"
          aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={menuOpen}
          aria-controls="oinelovo-mobile-navigation"
          onClick={() => (menuOpen ? closeMenu(true) : setMenuOpen(true))}
        >
          {menuOpen ? (
            <X size="1.375rem" aria-hidden="true" />
          ) : (
            <Menu size="1.375rem" aria-hidden="true" />
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          className="oinelovo-header__mobile-menu"
          id="oinelovo-mobile-navigation"
          ref={menuRef}
        >
          <nav aria-label="Основная навигация">
            {pageLinks.map(([label, href]) =>
              href.startsWith("/") ? (
                <Link key={href} to={href} onClick={() => closeMenu()}>
                  {label}
                </Link>
              ) : (
                <a key={href} href={href} onClick={() => closeMenu()}>
                  {label}
                </a>
              ),
            )}
          </nav>
          <div className="oinelovo-header__mobile-phones">
            {siteConfig.phone && (
              <a href={siteConfig.phoneHref} onClick={() => closeMenu()}>
                <Phone size="1rem" aria-hidden="true" />
                {siteConfig.phone}
              </a>
            )}
            {siteConfig.phone2 && (
              <a href={siteConfig.phone2Href} onClick={() => closeMenu()}>
                <Phone size="1rem" aria-hidden="true" />
                {siteConfig.phone2}
              </a>
            )}
            <p>{siteConfig.hours}</p>
          </div>
        </div>
      )}
    </header>
  );
}

export function OinelovoFooter() {
  return (
    <footer className="oinelovo-footer">
      <div className="oinelovo-container oinelovo-footer__row">
        <Brand className="brand-footer" />
        <nav aria-label="Навигация в подвале">
          {pageLinks.map(([label, href]) =>
            href.startsWith("/") ? (
              <Link key={href} to={href}>
                {label}
              </Link>
            ) : (
              <a key={href} href={href}>
                {label}
              </a>
            ),
          )}
        </nav>
        <p className="oinelovo-footer__copyright">{siteConfig.copyright}</p>
      </div>
      <p className="oinelovo-container oinelovo-footer__offer">{offertaMsg}</p>
    </footer>
  );
}
