/**
 * GA4 Analytics Service — Server-side Google Analytics Data API v1 client
 * 
 * Uses the Google Analytics Data API to fetch real GA4 metrics:
 * - Sessions, users, pageviews, bounce rate, avg session duration
 * - Top pages, traffic sources, device categories
 * - Date-range comparison (7d, 30d, 90d)
 * 
 * Auth: Service Account JSON stored in integration_configs (key='ga4')
 * Requires: @google-analytics/data npm package
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { ENV } from "./_core/env";
import { eq } from "drizzle-orm";
import { integrationConfigs } from "../drizzle/schema";

const pool = mysql.createPool(ENV.databaseUrl);
const db = drizzle(pool);

// ── Types ──
export interface GA4Config {
  measurementId: string;
  propertyId: string;
  serviceAccountJson: string;
}

export interface GA4OverviewMetrics {
  sessions: number;
  users: number;
  newUsers: number;
  pageviews: number;
  bounceRate: number;
  avgSessionDuration: number; // seconds
  dateRange: { start: string; end: string };
}

export interface GA4TopPage {
  path: string;
  title: string;
  pageviews: number;
  avgTimeOnPage: number;
}

export interface GA4TrafficSource {
  source: string;
  medium: string;
  sessions: number;
  users: number;
}

export interface GA4DeviceBreakdown {
  category: string; // desktop, mobile, tablet
  sessions: number;
  percentage: number;
}

export interface GA4DashboardData {
  overview: GA4OverviewMetrics;
  topPages: GA4TopPage[];
  trafficSources: GA4TrafficSource[];
  devices: GA4DeviceBreakdown[];
  fetchedAt: string;
}

// ── Config loader ──
async function getGA4Config(): Promise<GA4Config | null> {
  try {
    const [row] = await db.select().from(integrationConfigs)
      .where(eq(integrationConfigs.integrationKey, 'ga4'));
    
    if (!row || !row.isEnabled) return null;
    
    const config = row.configJson ? JSON.parse(row.configJson) : {};
    if (!config.propertyId || !config.serviceAccountJson) return null;
    
    return {
      measurementId: config.measurementId || '',
      propertyId: config.propertyId,
      serviceAccountJson: config.serviceAccountJson,
    };
  } catch (err) {
    console.error('[GA4] Failed to load config:', err);
    return null;
  }
}

// ── Simple in-memory cache (5 min TTL) ──
const cache: { data: GA4DashboardData | null; expiry: number; key: string } = { data: null, expiry: 0, key: '' };

function getCacheKey(days: number): string {
  return `ga4_${days}_${new Date().toISOString().slice(0, 13)}`; // hourly granularity
}

// ── GA4 Data API client ──
async function createGA4Client(serviceAccountJson: string) {
  // Dynamic import to avoid hard dependency if package not installed
  const { BetaAnalyticsDataClient } = await import('@google-analytics/data');
  
  let credentials: any;
  try {
    credentials = JSON.parse(serviceAccountJson);
  } catch {
    throw new Error('Invalid service account JSON');
  }
  
  return new BetaAnalyticsDataClient({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    projectId: credentials.project_id,
  });
}

function getDateRange(days: number): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

// ── Fetch overview metrics ──
async function fetchOverview(client: any, propertyId: string, days: number): Promise<GA4OverviewMetrics> {
  const { startDate, endDate } = getDateRange(days);
  
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
      { name: 'newUsers' },
      { name: 'screenPageViews' },
      { name: 'bounceRate' },
      { name: 'averageSessionDuration' },
    ],
  });
  
  const row = response.rows?.[0];
  const vals = row?.metricValues || [];
  
  return {
    sessions: parseInt(vals[0]?.value || '0'),
    users: parseInt(vals[1]?.value || '0'),
    newUsers: parseInt(vals[2]?.value || '0'),
    pageviews: parseInt(vals[3]?.value || '0'),
    bounceRate: parseFloat(vals[4]?.value || '0'),
    avgSessionDuration: parseFloat(vals[5]?.value || '0'),
    dateRange: { start: startDate, end: endDate },
  };
}

// ── Fetch top pages ──
async function fetchTopPages(client: any, propertyId: string, days: number, limit = 10): Promise<GA4TopPage[]> {
  const { startDate, endDate } = getDateRange(days);
  
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'pageTitle' },
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'averageSessionDuration' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit,
  });
  
  return (response.rows || []).map((row: any) => ({
    path: row.dimensionValues?.[0]?.value || '',
    title: row.dimensionValues?.[1]?.value || '',
    pageviews: parseInt(row.metricValues?.[0]?.value || '0'),
    avgTimeOnPage: parseFloat(row.metricValues?.[1]?.value || '0'),
  }));
}

// ── Fetch traffic sources ──
async function fetchTrafficSources(client: any, propertyId: string, days: number, limit = 10): Promise<GA4TrafficSource[]> {
  const { startDate, endDate } = getDateRange(days);
  
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [
      { name: 'sessionSource' },
      { name: 'sessionMedium' },
    ],
    metrics: [
      { name: 'sessions' },
      { name: 'totalUsers' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit,
  });
  
  return (response.rows || []).map((row: any) => ({
    source: row.dimensionValues?.[0]?.value || '(direct)',
    medium: row.dimensionValues?.[1]?.value || '(none)',
    sessions: parseInt(row.metricValues?.[0]?.value || '0'),
    users: parseInt(row.metricValues?.[1]?.value || '0'),
  }));
}

// ── Fetch device breakdown ──
async function fetchDevices(client: any, propertyId: string, days: number): Promise<GA4DeviceBreakdown[]> {
  const { startDate, endDate } = getDateRange(days);
  
  const [response] = await client.runReport({
    property: `properties/${propertyId}`,
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: 'deviceCategory' }],
    metrics: [{ name: 'sessions' }],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
  });
  
  const rows = (response.rows || []).map((row: any) => ({
    category: row.dimensionValues?.[0]?.value || 'unknown',
    sessions: parseInt(row.metricValues?.[0]?.value || '0'),
    percentage: 0,
  }));
  
  const total = rows.reduce((sum: number, r: any) => sum + r.sessions, 0);
  for (const r of rows) {
    r.percentage = total > 0 ? Math.round((r.sessions / total) * 100) : 0;
  }
  
  return rows;
}

// ── Main: fetch full dashboard data ──
export async function fetchGA4Dashboard(days: number = 30): Promise<GA4DashboardData | null> {
  // Check cache
  const cacheKey = getCacheKey(days);
  if (cache.data && cache.key === cacheKey && Date.now() < cache.expiry) {
    return cache.data;
  }
  
  const config = await getGA4Config();
  if (!config) return null;
  
  try {
    const client = await createGA4Client(config.serviceAccountJson);
    
    const [overview, topPages, trafficSources, devices] = await Promise.all([
      fetchOverview(client, config.propertyId, days),
      fetchTopPages(client, config.propertyId, days),
      fetchTrafficSources(client, config.propertyId, days),
      fetchDevices(client, config.propertyId, days),
    ]);
    
    const result: GA4DashboardData = {
      overview,
      topPages,
      trafficSources,
      devices,
      fetchedAt: new Date().toISOString(),
    };
    
    // Cache for 5 minutes
    cache.data = result;
    cache.key = cacheKey;
    cache.expiry = Date.now() + 5 * 60 * 1000;
    
    return result;
  } catch (err: any) {
    console.error('[GA4] API error:', err.message);
    throw new Error(`GA4 API error: ${err.message}`);
  }
}

// ── Test connection ──
export async function testGA4Connection(): Promise<{ success: boolean; message: string; propertyName?: string }> {
  const config = await getGA4Config();
  if (!config) {
    return { success: false, message: 'GA4 not configured or disabled / تحليلات GA4 غير مفعّلة' };
  }
  
  try {
    const client = await createGA4Client(config.serviceAccountJson);
    
    // Simple test: fetch 1 day of sessions
    const [response] = await client.runReport({
      property: `properties/${config.propertyId}`,
      dateRanges: [{ startDate: '1daysAgo', endDate: 'today' }],
      metrics: [{ name: 'sessions' }],
    });
    
    const sessions = response.rows?.[0]?.metricValues?.[0]?.value || '0';
    return {
      success: true,
      message: `Connected! ${sessions} sessions in last 24h / متصل! ${sessions} جلسة في آخر 24 ساعة`,
      propertyName: `Property ${config.propertyId}`,
    };
  } catch (err: any) {
    return { success: false, message: `Connection failed: ${err.message}` };
  }
}

// ── Check if GA4 is configured ──
export async function isGA4Configured(): Promise<boolean> {
  const config = await getGA4Config();
  return config !== null;
}
