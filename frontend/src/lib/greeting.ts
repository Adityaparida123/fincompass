export type GreetingPeriod = "morning" | "afternoon" | "evening" | "night";

export function getTimeOfDay(date: Date = new Date()): GreetingPeriod {
  const hour = date.getHours();
  if (hour < 5) return "night";
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "night";
}
