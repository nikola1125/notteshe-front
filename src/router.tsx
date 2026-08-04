import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Start loading route data when the user hovers over a link.
    defaultPreload: "intent",
    // Keep loader data fresh for the entire session — prevents re-running
    // loaders and re-mounting pages when the user navigates back.
    defaultStaleTime: Infinity,
    // Keep cached route data in memory for 30 minutes of inactivity.
    defaultGcTime: 30 * 60 * 1000,
    // Preloaded data is also kept fresh so hover-prefetch hits the cache.
    defaultPreloadStaleTime: 30 * 1000,
  });

  return router;
};
