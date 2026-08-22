import { describe, it, expect } from "vitest";
import { getTimeOfDay } from "@/lib/greeting";

function at(hour: number, minute: number): Date {
  return new Date(2026, 7, 21, hour, minute, 0, 0);
}

describe("getTimeOfDay", () => {
  it.each([
    [0, 0, "night"],
    [4, 59, "night"],
    [5, 0, "morning"],
    [8, 0, "morning"],
    [11, 59, "morning"],
    [12, 0, "afternoon"],
    [16, 59, "afternoon"],
    [17, 0, "evening"],
    [20, 59, "evening"],
    [21, 0, "night"],
    [23, 59, "night"],
  ])("%02d:%02d -> %s", (hour, minute, expected) => {
    expect(getTimeOfDay(at(hour, minute))).toBe(expected);
  });
});
