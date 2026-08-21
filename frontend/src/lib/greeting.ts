export type GreetingPeriod = "morning" | "afternoon" | "evening";

export function getTimeOfDay(date: Date = new Date()): GreetingPeriod {
  const hour = date.getHours();
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

export function getTimeBasedGreeting(date: Date = new Date()): string {
  const period = getTimeOfDay(date);
  if (period === "morning") return "Good morning";
  if (period === "afternoon") return "Good afternoon";
  return "Good evening";
}
