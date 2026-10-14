export const PLOTS_UPDATED_CHANNEL = "hamper:plots-updated";

export function notifyPlotsUpdated() {
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(PLOTS_UPDATED_CHANNEL);
    channel.postMessage("updated");
    channel.close();
  }
}
