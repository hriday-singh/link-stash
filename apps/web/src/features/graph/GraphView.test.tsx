import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { GraphView } from "./GraphView";

const {
  mockKillSigma,
  mockZoom,
  mockReset,
  mockRefresh,
  mockOn,
  mockStartSupervisor,
  mockStopSupervisor,
  mockKillSupervisor,
  mockIsRunning,
} = vi.hoisted(() => ({
  mockKillSigma: vi.fn(),
  mockZoom: vi.fn(),
  mockReset: vi.fn(),
  mockRefresh: vi.fn(),
  mockOn: vi.fn(),
  mockStartSupervisor: vi.fn(),
  mockStopSupervisor: vi.fn(),
  mockKillSupervisor: vi.fn(),
  mockIsRunning: vi.fn(() => true),
}));

vi.mock("sigma", () => {
  return {
    default: class MockSigma {
      kill = mockKillSigma;
      refresh = mockRefresh;
      on = mockOn;
      getCamera() {
        return {
          animatedZoom: mockZoom,
          animatedReset: mockReset,
        };
      }
    },
    Sigma: class MockSigma {
      kill = mockKillSigma;
      refresh = mockRefresh;
      on = mockOn;
      getCamera() {
        return {
          animatedZoom: mockZoom,
          animatedReset: mockReset,
        };
      }
    },
  };
});

vi.mock("graphology-layout-forceatlas2/worker", () => {
  return {
    default: class MockFA2 {
      start = mockStartSupervisor;
      stop = mockStopSupervisor;
      kill = mockKillSupervisor;
      isRunning = mockIsRunning;
    },
  };
});

describe("GraphView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when there are no nodes", () => {
    render(<GraphView graphData={{ nodes: [], edges: [] }} emptyMessage="Empty graph test" />);
    expect(screen.getByTestId("graph-empty")).toBeInTheDocument();
    expect(screen.getByText("Empty graph test")).toBeInTheDocument();
  });

  it("carries data-lenis-prevent attribute on container", () => {
    render(
      <GraphView
        graphData={{
          nodes: [{ id: "n1", label: "Node 1", category: "models", kind: "model", size: 10 }],
          edges: [],
        }}
      />
    );

    const container = screen.getByTestId("graph-container");
    expect(container).toHaveAttribute("data-lenis-prevent");
  });

  it("shows 'No connections yet' chip for isolated card (Review Focus #2)", () => {
    render(
      <GraphView
        graphData={{
          nodes: [{ id: "lone-card", label: "Lone Card", category: "repos-tools", kind: "tool", size: 12 }],
          edges: [],
        }}
      />
    );

    expect(screen.getByTestId("isolated-notice")).toBeInTheDocument();
    expect(screen.getByText("No connections yet")).toBeInTheDocument();
  });

  it("starts FA2 supervisor worker on mount", () => {
    render(
      <GraphView
        graphData={{
          nodes: [
            { id: "n1", label: "N1", category: "models", kind: "model", size: 10 },
            { id: "n2", label: "N2", category: "repos-tools", kind: "tool", size: 10 },
          ],
          edges: [{ source: "n1", target: "n2", type: "wikilink" }],
        }}
      />
    );

    expect(mockStartSupervisor).toHaveBeenCalled();
  });

  it("kills supervisor worker and sigma on unmount (Review Focus #5)", () => {
    const { unmount } = render(
      <GraphView
        graphData={{
          nodes: [
            { id: "n1", label: "N1", category: "models", kind: "model", size: 10 },
            { id: "n2", label: "N2", category: "repos-tools", kind: "tool", size: 10 },
          ],
          edges: [{ source: "n1", target: "n2", type: "wikilink" }],
        }}
      />
    );

    unmount();

    expect(mockStopSupervisor).toHaveBeenCalled();
    expect(mockKillSupervisor).toHaveBeenCalled();
    expect(mockKillSigma).toHaveBeenCalled();
  });

  it("invokes zoom and reset controls when clicked", async () => {
    const user = userEvent.setup();
    render(
      <GraphView
        graphData={{
          nodes: [
            { id: "n1", label: "N1", category: "models", kind: "model", size: 10 },
            { id: "n2", label: "N2", category: "repos-tools", kind: "tool", size: 10 },
          ],
          edges: [{ source: "n1", target: "n2", type: "wikilink" }],
        }}
      />
    );

    const zoomInBtn = screen.getByLabelText("Zoom in");
    const zoomOutBtn = screen.getByLabelText("Zoom out");
    const resetBtn = screen.getByLabelText("Reset zoom");

    await user.click(zoomInBtn);
    expect(mockZoom).toHaveBeenCalledWith({ factor: 1.5 });

    await user.click(zoomOutBtn);
    expect(mockZoom).toHaveBeenCalledWith({ factor: 1 / 1.5 });

    await user.click(resetBtn);
    expect(mockReset).toHaveBeenCalled();
  });
});
