import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ToastProvider } from "./lib/ToastProvider.jsx";
import "./styles.css";

// A recovery link can land on any page, depending on the project's redirect
// settings, so send it to the screen that can finish the reset.
if (window.location.hash.includes("type=recovery") && window.location.pathname !== "/reset-password") {
  window.location.replace(`/reset-password${window.location.hash}`);
}

const legacyWorkerCleanupKey = "contbus-legacy-worker-cleanup-v1";

async function clearLegacyServiceWorker() {
  if (!("serviceWorker" in navigator)) return false;

  const wasControlled = Boolean(navigator.serviceWorker.controller);
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  return wasControlled;
}

async function startApp() {
  try {
    const wasControlled = await clearLegacyServiceWorker();
    if (wasControlled && sessionStorage.getItem(legacyWorkerCleanupKey) !== "done") {
      sessionStorage.setItem(legacyWorkerCleanupKey, "done");
      window.location.reload();
      return;
    }
    sessionStorage.removeItem(legacyWorkerCleanupKey);
  } catch (error) {
    console.warn("Legacy service worker cleanup failed", error);
  }

  createRoot(document.getElementById("root")).render(
    <ToastProvider>
      <App />
    </ToastProvider>,
  );
}

startApp();
