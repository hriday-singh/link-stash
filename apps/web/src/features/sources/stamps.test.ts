import { describe, it, expect } from "vitest";
import { parseStamp, formatDuration, splitStamps } from "./stamps";

describe("parseStamp", () => {
  it("parses valid MM:SS timestamps", () => {
    expect(parseStamp("0:00")).toBe(0);
    expect(parseStamp("0:15")).toBe(15);
    expect(parseStamp("00:15")).toBe(15);
    expect(parseStamp("1:30")).toBe(90);
    expect(parseStamp("01:30")).toBe(90);
    expect(parseStamp("12:45")).toBe(765);
    expect(parseStamp("59:59")).toBe(3599);
  });

  it("parses valid H:MM:SS timestamps", () => {
    expect(parseStamp("1:00:00")).toBe(3600);
    expect(parseStamp("01:02:15")).toBe(3735);
    expect(parseStamp("2:15:30")).toBe(8130);
  });

  it("rejects out-of-bounds minutes and seconds", () => {
    expect(parseStamp("99:99")).toBeNull();
    expect(parseStamp("12:60")).toBeNull();
    expect(parseStamp("60:00")).toBeNull();
    expect(parseStamp("1:60:00")).toBeNull();
    expect(parseStamp("1:00:60")).toBeNull();
  });

  it("rejects malformed patterns", () => {
    expect(parseStamp("1:2")).toBeNull();
    expect(parseStamp("1:")).toBeNull();
    expect(parseStamp(":15")).toBeNull();
    expect(parseStamp("-0:15")).toBeNull();
    expect(parseStamp("hello")).toBeNull();
    expect(parseStamp("")).toBeNull();
    expect(parseStamp(null)).toBeNull();
    expect(parseStamp(undefined)).toBeNull();
  });
});

describe("formatDuration", () => {
  it("formats durations into MM:SS or H:MM:SS", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(15)).toBe("0:15");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatDuration(3665)).toBe("1:01:05");
  });

  it("handles negative or invalid inputs gracefully", () => {
    expect(formatDuration(-10)).toBe("0:00");
    expect(formatDuration(NaN)).toBe("0:00");
  });
});

describe("splitStamps", () => {
  it("returns plain text token when no stamps exist", () => {
    const chunks = splitStamps("This is a simple transcript with no stamps.");
    expect(chunks).toEqual([{ type: "text", text: "This is a simple transcript with no stamps." }]);
  });

  it("splits text with valid timestamps", () => {
    const text = "At 0:12 we introduce agents, and at 1:05 we show the demo.";
    const chunks = splitStamps(text);

    expect(chunks).toEqual([
      { type: "text", text: "At " },
      { type: "stamp", raw: "0:12", seconds: 12 },
      { type: "text", text: " we introduce agents, and at " },
      { type: "stamp", raw: "1:05", seconds: 65 },
      { type: "text", text: " we show the demo." },
    ]);
  });

  it("leaves malformed stamps as plain text", () => {
    const text = "The score was 99:99 and ratio was 1:2.";
    const chunks = splitStamps(text);

    expect(chunks).toEqual([{ type: "text", text: "The score was 99:99 and ratio was 1:2." }]);
  });

  it("handles empty or null text", () => {
    expect(splitStamps("")).toEqual([]);
    expect(splitStamps(null)).toEqual([]);
    expect(splitStamps(undefined)).toEqual([]);
  });
});
