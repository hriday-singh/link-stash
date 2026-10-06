import { createFileRoute } from "@tanstack/react-router";
import { MockInventory } from "@/mock/MockViews";

export const Route = createFileRoute("/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-8 lg:py-8">
      <MockInventory />
    </div>
  );
}
