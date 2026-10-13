export const featureLabels = {
  'page.view': 'Page loaded', 'portfolio.open': 'Open portfolio', 'portfolio.project': 'View project',
  'portfolio.category': 'Filter category', 'portfolio.search': 'Search portfolio',
  'portfolio.next': 'Next project', 'portfolio.featured': 'Featured navigation',
  'create.open': 'Open Create', 'create.step': 'Create form step', 'create.submit': 'Submit Create',
  'about.open': 'About / CV', 'dashboard.open': 'Dashboard', 'launcher.open': 'Applications',
  'terminal.open': 'Terminal', 'music.open': 'Music', 'layout.change': 'Change layout',
} as const;
export type FeatureEvent = keyof typeof featureLabels;
export type TrafficClass = 'human' | 'bot' | 'suspected' | 'unknown';
export type ReportingPeriod = 'day' | 'month' | 'quarter' | 'year';
export const trafficLabels: Record<TrafficClass, string> = {
  human: 'Likely human', bot: 'Verified bot', suspected: 'Suspected bot', unknown: 'Unclassified',
};
export const reportingTimezone = 'Asia/Bangkok';
export function reportingDay(date = new Date()) { return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 10); }
export function reportingRange(period: ReportingPeriod, anchor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !Number.isFinite(Date.parse(anchor)) || new Date(anchor).toISOString().slice(0, 10) !== anchor) throw new Error('Invalid reporting date.');
  const [year, month, day] = anchor.split('-').map(Number);
  if (year < 2020 || year > 2100) throw new Error('Date must be between 2020 and 2100.');
  const startMonth = period === 'year' ? 1 : period === 'quarter' ? Math.floor((month - 1) / 3) * 3 + 1 : month;
  const start = new Date(Date.UTC(year, startMonth - 1, period === 'day' ? day : 1));
  const end = new Date(start);
  if (period === 'day') end.setUTCDate(end.getUTCDate() + 1);
  else end.setUTCMonth(end.getUTCMonth() + (period === 'year' ? 12 : period === 'quarter' ? 3 : 1));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
export type AnalyticsReport = {
  period: ReportingPeriod; start: string; end: string; timezone: string; generatedAt: string; environment: string;
  totals: Record<TrafficClass, number>; browserLoads: number; actions: number;
  timeline: { day: string; human: number; bot: number; suspected: number; unknown: number; actions: number; accepted: number; blocked: number }[];
  features: { event: FeatureEvent; classification: TrafficClass; count: number }[];
  trafficHistory: { id: string; createdAt: string; source: string; event: string; path: string; classification: TrafficClass; reason: string; score: number | null; status: number }[];
  requests: { accepted: number; blocked: number; pending: number; sent: number; failed: number };
  requestHistory: { id: string; requestId: string | null; createdAt: string; outcome: string; reason: string; emailHint: string; category: string | null; notification: string | null }[];
  nextTrafficCursor: string | null; nextRequestCursor: string | null;
  historyCounts: { traffic: number; requests: number };
  historyLimit: number;
};
export type RequestPublicConfig = { enabled: boolean; turnstileSiteKey: string; local: boolean; dailyEmailLimit: number };
