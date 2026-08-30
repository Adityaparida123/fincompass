export type ChatTopic =
  | "food"
  | "savings"
  | "debt"
  | "expenses"
  | "budget"
  | "investing"
  | "credit"
  | "income"
  | "pricing"
  | "inventory"
  | "expansion"
  | "sales"
  | "schemes"
  | "cashflow"
  | "health"
  | "general";

/** Live dashboard facts used to personalize follow-up suggestions. */
export interface DashboardContext {
  healthScore?: number;
  healthLabel?: string;
  netCashFlow?: string;
  topExpenseCategory?: string;
}

const TOPIC_KEYWORDS: Array<[ChatTopic, RegExp]> = [
  ["health", /\b(health score|health is|wellbeing|financial health|score is)\b/i],
  ["pricing", /\b(price|pricing|charge|rate|margin|mrp|daam|कीमत|दाम)\b/i],
  ["inventory", /\b(stock|inventory|restock|purchase|buy stock|maal)\b/i],
  [
    "expansion",
    /\b(expand|expansion|machine|cart|shop|new business|start a|open a|dukaan|capital|grow my)\b/i,
  ],
  ["sales", /\b(sales?|revenue|profit|customers?|sell|selling|bikri|munafa|kamai)\b/i],
  ["schemes", /\b(scheme|yojana|government|subsidy|sarkari|योजना)\b/i],
  ["cashflow", /\b(cash flow|cashflow|money coming|payments due|nagad)\b/i],
  ["food", /\b(food|eat|meal|lunch|dinner|breakfast|biryani|biriyani|grocer|restaurant|snack|hunger|khana)\b/i],
  ["savings", /\b(save|saving|savings|stash|emergency fund|bachat)\b/i],
  ["debt", /\b(debt|loan|emi|borrow|repay|credit card balance|interest|udhaar|karz)\b/i],
  ["expenses", /\b(expense|spend|spending|spent|cost|paid|kharch)\b/i],
  ["budget", /\b(budget|plan my money|allocate|allocation)\b/i],
  ["investing", /\b(invest|mutual fund|sip|stocks|shares|fd|fixed deposit)\b/i],
  ["credit", /\b(credit score|cibil|readiness|creditworthiness)\b/i],
  ["income", /\b(income|salary|earn|earnings|wage|payout)\b/i],
];

const TOPIC_FOLLOW_UPS: Record<ChatTopic, string[]> = {
  pricing: [
    "What price should I charge for my main product?",
    "How do I know if my price covers all my costs?",
    "How much margin is safe for a small business?",
    "Should I lower prices to sell more?",
    "Can you help me calculate break-even?",
    "How do competitors' prices affect what I charge?",
  ],
  inventory: [
    "How much stock should I buy at once?",
    "When is the right time to restock?",
    "How do I avoid tying up money in stock?",
    "What if my stock gets damaged or expires?",
    "Should I buy more stock before festival season?",
    "How can I track which items sell fastest?",
  ],
  expansion: [
    "How much capital would I need in total?",
    "Can I afford this from my current cash flow?",
    "Should I save first or take a loan?",
    "What are the risks of expanding right now?",
    "How long until a new investment pays back?",
    "Are there government schemes that could help?",
  ],
  sales: [
    "Is my business making enough profit?",
    "Which expenses are eating my profit?",
    "How can I increase my sales slowly and safely?",
    "Are my customers paying on time?",
    "What should I do if sales fall this month?",
    "How do I record daily sales properly?",
  ],
  schemes: [
    "Which schemes fit my type of business?",
    "Do I need documents to apply for these schemes?",
    "Where do I verify scheme eligibility officially?",
    "Are there schemes for women entrepreneurs?",
    "Can a loan under a government scheme help me?",
    "How do I check if my state has extra benefits?",
  ],
  cashflow: [
    "Why does my cash feel tight even when sales are good?",
    "How much working capital should I keep ready?",
    "When do my biggest payments go out each month?",
    "How can I improve my cash flow this month?",
    "Should I allow customers to pay later (udhaar)?",
    "What buffer should I keep for slow days?",
  ],
  food: [
    "How much cash will you receive next?",
    "Can I still eat well under {amount}?",
    "Do you have any expenses due today?",
    "What meals can I plan for about {nextAmount} this week?",
    "Would a cheaper option work better today?",
    "How much should I keep aside for food monthly?",
  ],
  savings: [
    "How much should I save every month?",
    "Is saving {amount} every month realistic for me?",
    "Where can I reduce spending to save more?",
    "How big should my emergency fund be?",
    "Should I separate business and personal savings?",
    "Which expenses hurt my savings most?",
  ],
  debt: [
    "Can I repay comfortably every month?",
    "Which debt should I pay first?",
    "What happens if I pay extra toward my loan?",
    "Could I clear {amount} faster by paying extra each month?",
    "How does my debt affect my business credit readiness?",
    "What alternatives exist before borrowing again?",
  ],
  expenses: [
    "Which expense grew the most recently?",
    "Would you like suggestions to reduce an expense?",
    "Where am I spending the most?",
    "Is any expense unusually high this month?",
    "Can you help me set category limits?",
    "Which costs are business vs personal?",
  ],
  budget: [
    "How should I split income between business and home?",
    "What is a realistic monthly budget for me?",
    "How much working capital should stay aside?",
    "Can you review my current budget?",
    "What should I do with leftover budget?",
    "How do I stick to my budget on slow weeks?",
  ],
  investing: [
    "What is a safe first investment for me?",
    "Should I invest or clear debt first?",
    "How do I start investing small amounts?",
    "Is a fixed deposit useful for business reserves?",
    "What return can I realistically expect?",
    "How much can I invest without hurting operations?",
  ],
  credit: [
    "How can I improve my business credit readiness?",
    "What factors affect my score the most?",
    "Does steady cash flow improve my score?",
    "How long until my readiness improves?",
    "What documents help show financial consistency?",
    "Can you explain my readiness breakdown simply?",
  ],
  health: [
    "What is driving my health score up or down?",
    "Which factor needs the most attention right now?",
    "How is this score different from a credit score?",
    "What is the quickest way to move my score higher?",
    "Does this score stay private and between us?",
    "How does my health score change each month?",
  ],
  income: [
    "Is my income stable enough month to month?",
    "How do I plan for irregular income?",
    "What portion of income should go to needs?",
    "Can I increase income without big investment?",
    "How should I use my next payout?",
    "Is my income enough for my goals?",
  ],
  general: [
    "How is my business doing overall?",
    "What should I focus on financially next?",
    "Can I afford a small purchase this week?",
    "Where am I overspending right now?",
    "How is my cash flow looking lately?",
    "Any opportunities I should prepare for locally?",
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
 * by the user, blends in one question from a related topic so sets evolve
 * across the conversation, and never repeats the previous set or echoes
 * the user's own question.
 *
 * When `dashboardContext` is provided, live dashboard facts (health score,
 * net cash flow, biggest expense category) are blended in first so the
 * suggestions reflect the user's actual numbers. Omitting it keeps the
 * exact previous behaviour, so existing callers and tests are unaffected.
 */
export function generateFollowUps(
  userMessage: string,
  assistantReply: string,
  turnIndex: number,
  previousSuggestions: string[] = [],
  dashboardContext: DashboardContext = {},
): string[] {
  const hasContext = Object.values(dashboardContext).some(
    (v) => v != null && v !== "",
  );
  const contextLine = hasContext
    ? ` context: health status ${dashboardContext.healthScore}${dashboardContext.healthLabel ? ` (${dashboardContext.healthLabel})` : ""}${dashboardContext.netCashFlow ? `, net cash flow ${dashboardContext.netCashFlow}` : ""}${dashboardContext.topExpenseCategory ? `, largest expense category ${dashboardContext.topExpenseCategory}` : ""}`
    : "";
  const topic = detectChatTopic(
    `${userMessage} ${assistantReply.slice(0, 400)}${contextLine}`,
  );
  const pool = TOPIC_FOLLOW_UPS[topic];
  const amount = extractAmount(userMessage);
  const context = { amount: amount ? formatAmount(amount) : "₹50", nextAmount: nextAmount(amount ?? 50) };

  const fill = (template: string) =>
    template.replace("{amount}", context.amount).replace("{nextAmount}", context.nextAmount);

  const candidates = pool.map(fill);

  // Blend one candidate from a neighbouring topic so suggestions keep
  // evolving instead of cycling the same static list.
  const otherTopics = (Object.keys(TOPIC_FOLLOW_UPS) as ChatTopic[]).filter((tpc) => tpc !== topic);
  const neighbour = otherTopics[(turnIndex + topic.length) % otherTopics.length];
  candidates.push(fill(TOPIC_FOLLOW_UPS[neighbour][turnIndex % TOPIC_FOLLOW_UPS[neighbour].length]));

  const seen = new Set(previousSuggestions.map(normalize));
  const userNorm = normalize(userMessage);
  const results: string[] = [];

  if (hasContext) {
    const dataAware: string[] = [];
    if (dashboardContext.healthScore != null) {
      dataAware.push(
        `My dashboard health is ${dashboardContext.healthScore}/100${dashboardContext.healthLabel ? ` (${dashboardContext.healthLabel})` : ""}. What is driving it and what should I improve first?`,
      );
    }
    if (dashboardContext.netCashFlow != null) {
      dataAware.push(
        `My net cash flow right now is about ${dashboardContext.netCashFlow}. What should I do first to stay safe?`,
      );
    }
    if (dashboardContext.topExpenseCategory != null) {
      dataAware.push(
        `My biggest expense category is "${dashboardContext.topExpenseCategory}". Is that reasonable and where can I cut?`,
      );
    }
    for (const candidate of dataAware) {
      const norm = normalize(candidate);
      if (seen.has(norm)) continue;
      if (norm === userNorm || userNorm.includes(norm) || norm.includes(userNorm)) continue;
      seen.add(norm);
      results.push(candidate);
    }
  }

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
