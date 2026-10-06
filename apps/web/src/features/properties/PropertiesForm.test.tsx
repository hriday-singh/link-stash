import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it, vi } from "vitest";
import type { CardDetail } from "@/api/client";
import { PropertiesForm, type PropertiesFormProps } from "./PropertiesForm";

const mockCard: CardDetail["card"] = {
  schema: 1,
  key: "github:user/awesome-tool",
  title: "Awesome Tool",
  category: "repos-tools",
  kind: "repo",
  tags: ["cli", "productivity"],
  url: "https://github.com/user/awesome-tool",
  added: "2026-10-06",
  sources: ["src-123"],
  overlaps: ["cli-runner"],
  facts: { stars: 1200, license: "MIT" },
  features: ["Fast execution", "Zero config"],
};

async function renderPropertiesForm(props: Partial<PropertiesFormProps> = {}) {
  const onSaveField = props.onSaveField ?? vi.fn();
  const formProps: PropertiesFormProps = {
    card: mockCard,
    categories: [
      { name: "repos-tools", color: "cat-repos-tools" },
      { name: "models", color: "cat-models" },
    ],
    suggestedTags: ["cli", "agent", "tool"],
    onSaveField,
    ...props,
  };

  const rootRoute = createRootRoute({
    component: () => <PropertiesForm {...formProps} />,
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });

  await router.load();
  return {
    ...render(<RouterProvider router={router} />),
    onSaveField,
  };
}

describe("PropertiesForm", () => {
  it("renders read-only fields like key, URL, facts, features, and overlaps", async () => {
    await renderPropertiesForm();

    expect(screen.getByText("github:user/awesome-tool")).toBeInTheDocument();
    expect(screen.getByText("https://github.com/user/awesome-tool")).toBeInTheDocument();
    expect(screen.getByText("cli-runner")).toBeInTheDocument();
    expect(screen.getByText("Fast execution")).toBeInTheDocument();
    expect(screen.getByText("1200")).toBeInTheDocument();
    expect(screen.getByText("MIT")).toBeInTheDocument();
  });

  it("renders existing tags as chips and allows adding tags", async () => {
    const user = userEvent.setup();
    const { onSaveField } = await renderPropertiesForm();

    expect(screen.getByText("cli")).toBeInTheDocument();
    expect(screen.getByText("productivity")).toBeInTheDocument();

    const tagInput = screen.getByPlaceholderText("Add tag…");
    await user.type(tagInput, "newtag{Enter}");

    expect(onSaveField).toHaveBeenCalledWith({
      tags: ["cli", "productivity", "newtag"],
    });
  });

  it("displays field errors next to fields", async () => {
    await renderPropertiesForm({
      fieldErrors: {
        category: "Unknown category provided.",
        tags: "Duplicate tags detected.",
      },
    });

    expect(screen.getByText("Unknown category provided.")).toBeInTheDocument();
    expect(screen.getByText("Duplicate tags detected.")).toBeInTheDocument();
  });
});
