import { createAPIFileRoute } from "@tanstack/react-start/api";
import { handleSitemap } from "@/lib/sitemap";

export const APIRoute = createAPIFileRoute("/api/sitemap.xml")({
  GET: () => handleSitemap(),
});
