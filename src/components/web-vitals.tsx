"use client";

import { useReportWebVitals } from "next/web-vitals";

type Metric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0];

function reportMetric(metric: Metric) {
  const payload = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    delta: metric.delta,
    rating: metric.rating,
    navigationType: metric.navigationType,
    pathname: window.location.pathname,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/web-vitals", payload);
    return;
  }
  void fetch("/api/web-vitals", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json" },
    keepalive: true,
  });
}

/** Boundary cliente mínima para telemetría real de rendimiento. */
export function WebVitals() {
  useReportWebVitals(reportMetric);
  return null;
}
