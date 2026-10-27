import type { MouseEventHandler } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../images/logo";
import { siteConfig } from "../lib/constants";

import "./Brand.css";

interface BrandProps {
  className?: string;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}

export function Brand({ className = "", onClick }: BrandProps) {
  return (
    <Link
      className={`brand ${className}`.trim()}
      to="/"
      aria-label={`${siteConfig.brand} — главная`}
      onClick={onClick}
    >
      <Logo />
      <span className="brand-name">
        {siteConfig.brand}
        <small>{siteConfig.brandSubtitle}</small>
      </span>
    </Link>
  );
}
