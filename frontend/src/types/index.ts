export interface UserSummary {
  id: number;
  email: string;
  full_name: string;
  phone: string | null;
  preferred_language: "en" | "hi";
  currency: string;
  timezone: string;
}

export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

export interface AuthResponse {
  user: UserSummary;
  tokens: TokenPair;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    request_id?: string;
    details?: Record<string, unknown>;
  };
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  has_next: boolean;
}

export interface Transaction {
  id: number;
  date: string;
  description: string;
  amount: string;
  currency: string;
  transaction_type: "income" | "expense";
  category: string;
  subcategory: string | null;
  source: string;
}

export interface ExpenseSummary {
  period: string;
  total_expenses: string;
  total_income: string;
  net_cash_flow: string;
  transaction_count: number;
  categories: Record<string, string>;
  previous_period_total?: string;
  change_percent?: number;
  trend_direction?: "up" | "down" | "flat";
  daily_breakdown?: Record<string, string>;
  recurring_patterns?: string[];
  insights?: string[];
}

export interface CategoryBreakdown {
  category: string;
  total: string;
  count: number;
  share_percent: number;
}

export interface ExpenseTrends {
  granularity: string;
  points: Array<{ period: string; total: string; income?: string }>;
  overall_change_percent?: number;
  top_categories: CategoryBreakdown[];
}

export interface SavingsGoal {
  id: number;
  name: string;
  target_amount: string;
  current_amount: string;
  target_date: string | null;
  status: "active" | "completed" | "paused" | "abandoned";
  progress_percent: number;
}

export interface BudgetItem {
  id: number;
  period: string;
  category: string;
  limit_amount: string;
}

export interface BudgetStatus {
  id: number;
  period: string;
  category: string;
  limit_amount: string;
  spent: string;
  remaining: string;
  percent_used: number;
}

export interface DebtObligation {
  id: number;
  name: string;
  principal: string;
  monthly_payment: string;
  interest_rate: string;
  remaining_balance: string;
  due_date: string | null;
}

export interface ReadinessFactor {
  name: string;
  impact: number;
  direction: "positive" | "negative" | "neutral";
  explanation: string;
  value: string | null;
}

export interface ReadinessResult {
  score: number;
  version: string;
  factors: ReadinessFactor[];
  summary: string;
}

export interface ScoreCorrectionResult {
  previous_score: number;
  updated_score: number;
  changed_factors: ReadinessFactor[];
  reason: string;
  version: string;
}

export interface Recommendation {
  type: string;
  priority: number;
  title: string;
  reason: string;
}

export interface Scheme {
  id: number;
  name: string;
  description: string;
  jurisdiction: string;
  eligibility: string;
  benefits: string;
  source_url: string;
  last_verified: string;
  active: boolean;
}

export interface ConsentItem {
  consent_type: string;
  status: "granted" | "revoked";
  granted_at: string | null;
  revoked_at: string | null;
  version: number;
}

export interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  tool_used?: string;
  created_at: string;
}

export interface RecycleBinItem {
  id: number;
  resource_type: string;
  resource_id: string;
  deleted_at: string;
  deleted_data: Record<string, unknown>;
}

export interface EMIResult {
  principal: string;
  annual_interest_rate: string;
  tenure_months: number;
  monthly_emi: string;
  total_interest: string;
  total_payment: string;
  zero_interest: boolean;
}

export interface LoanSimulationResult {
  emi: string;
  cash_flow_before: string;
  cash_flow_after: string;
  debt_burden_before: string;
  debt_burden_after: string;
  affordability_ratio: string;
  warnings: string[];
  alternatives: string[];
  assumptions: string[];
  recommendation: string;
}
