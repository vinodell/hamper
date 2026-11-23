import { Phone } from 'lucide-react';
import { siteConfig } from '../lib';

import './HeaderContact.css';

export function HeaderContact() {
  return (
    <div className="header-contact">
      <Phone size="1.1875rem" aria-hidden="true" />
      <div>
        <a href={siteConfig.phoneHref}>{siteConfig.phone}</a>
        <a href={siteConfig.phone2Href}>{siteConfig.phone2}</a>
      </div>
    </div>
  );
}
