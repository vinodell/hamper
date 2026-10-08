export const PLOTS_UPDATED_CHANNEL = "hamper:plots-updated";

/** Same-tab views use the shared cache; notify other tabs after a saved change. */
export function notifyPlotsUpdated() {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(PLOTS_UPDATED_CHANNEL);
    channel.postMessage("updated");
    channel.close();
  }
}
