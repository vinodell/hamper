import { createRoot } from "react-dom/client";

import App from "./App";
import { preloadPlots } from "./lib/api";
import { adminPath } from "./lib/routes";

const siteBasePath = import.meta.env.BASE_URL.replace(/\/+$/, "");
const currentPath = window.location.pathname.replace(/\/+$/, "");
// The protected admin response supplies the same public snapshot, so a direct
// admin visit needs only that request. Public entries preload before rendering.
if (currentPath !== `${siteBasePath}${adminPath.slice(0, -1)}`) preloadPlots();
createRoot(document.getElementById("root")!).render(<App />);
