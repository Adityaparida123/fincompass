import { describe, it, expect } from "vitest";
import { getTimeBasedGreeting, getTimeOfDay } from "@/lib/greeting";

function at(hour: number, minute: number): Date {
  return new Date(2026, 7, 21, hour, minute, 0, 0);
}

describe("getTimeBasedGreeting", () => {
  it.each([
    [0, 0, "Good morning"],
    [8, 0, "Good morning"],
    [11, 59, "Good morning"],
    [12, 0, "Good afternoon"],
    [15, 0, "Good afternoon"],
    [16, 59, "Good afternoon"],
    [17, 0, "Good evening"],
    [23, 59, "Good evening"],
  ])("%02d:%02d -> %s", (hour, minute, expected) => {
    expect(getTimeBasedGreeting(at(hour, minute))).toBe(expected);
  });
});

describe("getTimeOfDay", () => {
  it.each([
    [0, 0, "morning"],
    [11, 59, "morning"],
    [12, 0, "afternoon"],
    [16, 59, "afternoon"],
    [17, 0, "evening"],
    [23, 59, "evening"],
  ])("%02d:%02d -> %s", (hour, minute, expected) => {
    expect(getTimeOfDay(at(hour, minute))).toBe(expected);
  });
});
