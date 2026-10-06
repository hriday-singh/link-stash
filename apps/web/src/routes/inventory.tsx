import { createFileRoute } from "@tanstack/react-router";
import { InventoryPage } from "@/features/inventory/InventoryPage";

export const Route = createFileRoute("/inventory")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <InventoryPage />
    </div>
  );
}
