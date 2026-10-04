import { createContext } from "react";
import type { Plot } from "../lib/constants";

export interface PlotsState {
  plots: Plot[];
  loading: boolean;
  error: string;
}

export const PlotsContext = createContext<PlotsState | null>(null);
