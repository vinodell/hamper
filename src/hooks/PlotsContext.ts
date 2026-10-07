import { createContext } from "react";
import type { PlotsSnapshot } from "../lib/plotsCache";

export const PlotsContext = createContext<PlotsSnapshot | null>(null);
