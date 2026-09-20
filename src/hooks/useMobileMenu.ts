import { useEffect, useState } from "react";

export function useMobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("menu-open", isOpen);
    return () => document.body.classList.remove("menu-open");
  }, [isOpen]);

  return {
    isOpen,
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((open) => !open),
  };
}
