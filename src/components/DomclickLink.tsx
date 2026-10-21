import { House, ArrowUpRight } from "lucide-react";
import { isValidMortgageUrl } from "../lib/plotMetadata";

import "./DomclickLink.css";

type DomclickLinkProps = {
  url?: string | null;
  plotId: string;
};

export function DomclickLink({ url, plotId }: DomclickLinkProps) {
  if (!url || !isValidMortgageUrl(url)) return null;

  return (
    <a
      className="domclick-link tw:motion-safe:transition-colors tw:duration-200"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="Объявление на Домклик"
      aria-label={`Участок ${plotId} на Домклик (откроется в новой вкладке)`}
    >
      <House size={19} strokeWidth={1.8} aria-hidden="true" />
      <ArrowUpRight
        className="domclick-link__arrow"
        size={10}
        aria-hidden="true"
      />
    </a>
  );
}
