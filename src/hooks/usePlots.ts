import { useContext } from "react";
import { PlotsContext } from "./PlotsContext";

export const usePlots = () => {
  const state = useContext(PlotsContext);
  if (!state) throw new Error("usePlots must be used within PlotsProvider");
  return state;
};
