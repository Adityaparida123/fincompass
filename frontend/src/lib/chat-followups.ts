export type ChatTopic =
  | "food"
  | "savings"
  | "debt"
  | "expenses"
  | "budget"
  | "investing"
  | "credit"
  | "income"
  | "general";

const TOPIC_KEYWORDS: Array<[ChatTopic, RegExp]> = [
  ["food", /\b(food|eat|meal|lunch|dinner|breakfast|biryani|biriyani|grocer|restaurant|snack|hunger|khana)\b/i],
  ["savings", /\b(save|saving|savings|stash|emergency fund|bachat)\b/i],
  ["debt", /\b(debt|loan|emi|borrow|repay|credit card balance|interest|udhaar)\b/i],
  ["expenses", /\b(expense|spend|spending|spent|cost|paid|purchase|kharch)\b/i],
  ["budget", /\b(budget|plan my money|allocate|allocation)\b/i],
  ["investing", /\b(invest|investing|mutual fund|sip|stocks|shares|fd|fixed deposit)\b/i],
  ["credit", /\b(credit score|cibil|readiness|creditworthiness)\b/i],
  ["income", /\b(income|salary|earn|earnings|wage|payout)\b/i],
];

const TOPIC_FOLLOW_UPS: Record<ChatTopic, string[]> = {
  food: [
    "What can I eat under {amount}?",
    "How can I save money on food?",
    "Can you help me plan today's spending?",
    "What should I eat tomorrow?",
    "Can you make me a {nextAmount} food plan?",
    "How much should I keep aside for food monthly?",
  ],
  savings: [
    "How much should I save this month?",
    "Where can I reduce my spending?",
    "Can you create a savings target for me?",
    "What is a good emergency fund size?",
    "How do I save {nextAmount} faster?",
    "Which expenses hurt my savings most?",
  ],
  debt: [
    "Which debt should I pay first?",
    "How much should I pay this month?",
    "Can you make a repayment plan?",
    "How do I avoid new debt?",
    "What happens if I pay extra toward my loan?",
    "How does my debt affect my credit readiness?",
  ],
  expenses: [
    "Where am I spending the most?",
    "How can I reduce this expense?",
    "Can you help me set a budget?",
    "What did I spend on recently?",
    "Is my spending trending up or down?",
    "Which category can I cut safely?",
  ],
  budget: [
    "How should I split my income each month?",
    "What is a realistic monthly budget for me?",
    "Can you review my current budget?",
    "How much fun money is safe per month?",
    "What should I do with leftover budget?",
    "How do I stick to my budget?",
  ],
  investing: [
    "What is a safe first investment for me?",
    "How much can I invest without hurting savings?",
    "Are fixed deposits better than mutual funds for me?",
    "What return can I realistically expect?",
    "How do I start investing small amounts?",
    "Should I invest or clear debt first?",
  ],
  credit: [
    "How can I improve my credit readiness?",
    "What factors affect my score the most?",
    "How long until my readiness improves?",
    "Does paying debt boost my score?",
    "What is the ideal credit utilization?",
    "Can you explain my readiness breakdown?",
  ],
  income: [
    "How does my income compare to my spending?",
    "Can I increase my savings rate?",
    "What portion of income should go to needs?",
    "How do I plan for irregular income?",
    "Is my income enough for my goals?",
    "How should I allocate my next payout?",
  ],
  general: [
    "Where am I spending the most this month?",
    "How much can I safely save right now?",
    "What is one expense I should cut?",
    "Can you summarize my financial health?",
    "What should I focus on financially next?",
    "How is my cash flow looking lately?",
  ],
};

/** Amounts used to personalize follow-ups (escalates from the user's amount). */
const AMOUNT_LADDER = [50, 100, 200, 500, 1000, 2000, 5000];

function extractAmount(text: string): number | null {
  const match = text.match(/₹\s?([\d,]+(?:\.\d+)?)|\b([\d,]+)\s?(?:rupees?|rs\.?\b|inr\b)/i);
  if (!match) return null;
  const raw = (match[1] ?? match[2] ?? "").replace(/,/g, "");
  const value = Number.parseFloat(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function nextAmount(amount: number): string {
  const up = AMOUNT_LADDER.find((step) => step > amount) ?? amount * 2;
  return `₹${up}`;
}

function formatAmount(amount: number): string {
  return `₹${amount % 1 === 0 ? amount.toFixed(0) : amount.toFixed(2)}`;
}

export function detectChatTopic(text: string): ChatTopic {
  for (const [topic, pattern] of TOPIC_KEYWORDS) {
    if (pattern.test(text)) return topic;
  }
  return "general";
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Generates contextual follow-up suggestions for the latest exchange.
 * Rotates through the topic pool by turn index so consecutive turns on
 * the same topic produce different sets, personalizes amounts mentioned
 * by the user, and never repeats the previous set or echoes the user's
 * own question.
 */
export function generateFollowUps(
  userMessage: string,
  assistantReply: string,
  turnIndex: number,
  previousSuggestions: string[] = [],
): string[] {
  const topic = detectChatTopic(`${userMessage} ${assistantReply.slice(0, 400)}`);
  const pool = TOPIC_FOLLOW_UPS[topic];
  const amount = extractAmount(userMessage);
  const context = { amount: amount ? formatAmount(amount) : "₹50", nextAmount: nextAmount(amount ?? 50) };

  const candidates = pool.map(
    (template) => template.replace("{amount}", context.amount).replace("{nextAmount}", context.nextAmount),
  );

  const seen = new Set(previousSuggestions.map(normalize));
  const userNorm = normalize(userMessage);
  const results: string[] = [];

  for (let offset = 0; offset < candidates.length && results.length < 3; offset++) {
    const candidate = candidates[(offset + turnIndex * 3) % candidates.length];
    const norm = normalize(candidate);
    if (seen.has(norm)) continue;
    if (norm === userNorm || userNorm.includes(norm) || norm.includes(userNorm)) continue;
    seen.add(norm);
    results.push(candidate);
  }

  return results;
}
