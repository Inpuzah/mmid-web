// src/app/admin/tools/hypixel-crawl/page.tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HypixelCrawlPage() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function runCrawl() {
    setRunning(true);
    setResult(null);

    try {
      const response = await fetch("/api/cron/hypixel-crawl", {
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET || ""}`,
        },
      });

      const data = await response.json();
      setResult(data);
    } catch (error: any) {
      setResult({ error: error.message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="mb-6 text-3xl font-bold">Hypixel Stats Crawler</h1>

      <Card>
        <CardHeader>
          <CardTitle>Manual Crawl Run</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-gray-600">
            Manually trigger a Hypixel stats update batch. Updates up to 40 players
            with stale data (older than 24 hours).
          </p>

          <Button onClick={runCrawl} disabled={running}>
            {running ? "Running..." : "Run Crawl Batch"}
          </Button>

          {result && (
            <div className="mt-4 rounded bg-gray-100 p-4">
              <pre className="text-xs">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
