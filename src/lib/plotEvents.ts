export const PLOTS_UPDATED_EVENT = "hamper:plots-updated";

/** Notify public views only after the server has saved an admin change. */
export function notifyPlotsUpdated() {
  window.dispatchEvent(new Event(PLOTS_UPDATED_EVENT));
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(PLOTS_UPDATED_EVENT);
    channel.postMessage("updated");
    channel.close();
  }
}
