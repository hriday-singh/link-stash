import { createFileRoute } from "@tanstack/react-router";
import { CardPage } from "@/features/card/CardPage";

export const Route = createFileRoute("/c/$slug")({
  component: CardPage,
});
