import { describe, it, expect } from "vitest";
import { detectChatTopic, generateFollowUps } from "@/lib/chat-followups";

describe("detectChatTopic", () => {
  it("detects food topics", () => {
    expect(detectChatTopic("I have only 10 rupees, can I eat biriyani today?")).toBe("food");
  });

  it("detects savings topics", () => {
    expect(detectChatTopic("How can I save more money?")).toBe("savings");
  });

  it("detects debt topics", () => {
    expect(detectChatTopic("Which loan should I repay first?")).toBe("debt");
  });

  it("falls back to general for unrelated questions", () => {
    expect(detectChatTopic("What is the weather today?")).toBe("general");
  });
});

describe("generateFollowUps", () => {
  const userMsg = "I have only ₹10, can I eat biriyani today?";
  const aiReply = "With ₹10, biryani would probably not fit your current budget.";

  it("returns at most 3 suggestions", () => {
    expect(generateFollowUps(userMsg, aiReply, 0).length).toBeLessThanOrEqual(3);
  });

  it("produces food-related suggestions for a food question", () => {
    const followUps = generateFollowUps(userMsg, aiReply, 0);
    expect(followUps.length).toBeGreaterThan(0);
    expect(followUps.some((s) => /eat|food|spending/i.test(s))).toBe(true);
  });

  it("personalizes amounts mentioned by the user", () => {
    const followUps = generateFollowUps(userMsg, aiReply, 0);
    expect(followUps.some((s) => s.includes("₹10"))).toBe(true);
    const later = generateFollowUps(userMsg, aiReply, 1);
    expect([...followUps, ...later].some((s) => s.includes("₹50"))).toBe(true);
  });

  it("does not repeat the previous turn's suggestions", () => {
    const first = generateFollowUps(userMsg, aiReply, 0);
    const second = generateFollowUps(
      "What can I eat under ₹50?",
      "Here are some options under ₹50...",
      1,
      first,
    );
    expect(second.some((s) => first.includes(s))).toBe(false);
  });

  it("never echoes the user's own question", () => {
    const followUps = generateFollowUps(userMsg, aiReply, 2);
    expect(followUps).not.toContain(userMsg);
  });

  it("generates different sets across turns on the same topic", () => {
    const first = generateFollowUps(userMsg, aiReply, 0);
    const second = generateFollowUps(userMsg, aiReply, 1);
    expect(first).not.toEqual(second);
  });
});
