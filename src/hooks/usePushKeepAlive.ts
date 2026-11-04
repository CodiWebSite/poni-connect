import { useEffect } from "react";
import { ensurePushSubscription } from "@/utils/pushNotifications";

/**
 * One silent pass per page load that keeps the device registered for push
 * notifications on the server. Browsers rotate their push address over time;
 * without this, notifications stop arriving with no warning and nobody can
 * tell why. Only ever acts when notifications are already allowed.
 */
export function usePushKeepAlive() {
  useEffect(() => {
    void ensurePushSubscription();
  }, []);
}
