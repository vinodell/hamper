import { useSyncExternalStore } from "react";
import { api } from "../lib/api";
import {
  getSiteSettingsSnapshot,
  subscribeSiteSettings,
} from "../lib/siteSettings";

function retry() {
  void api.getSettings({ force: true }).catch(() => {
    // The shared snapshot exposes the error and retains the last success.
  });
}

export function useSiteSettings() {
  const state = useSyncExternalStore(
    subscribeSiteSettings,
    getSiteSettingsSnapshot,
    getSiteSettingsSnapshot,
  );
  return { ...state, retry };
}
