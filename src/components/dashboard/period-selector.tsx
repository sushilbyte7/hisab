"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PeriodKey } from "@/lib/finance";

interface PeriodSelectorProps {
  period: PeriodKey;
  /** Current custom range, echoed into the date inputs (custom only). */
  from?: string;
  to?: string;
}

/**
 * Period switcher (Week / Month / Year / Custom). Updates the URL search
 * params so the server page re-fetches for the new range.
 */
export function PeriodSelector({ period, from, to }: PeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [showCustom, setShowCustom] = useState(period === "custom");
  const [customFrom, setCustomFrom] = useState(from ?? "");
  const [customTo, setCustomTo] = useState(to ?? "");

  const customValid =
    customFrom !== "" && customTo !== "" && customFrom <= customTo;

  function navigate(next: PeriodKey, range?: { from: string; to: string }) {
    const params = new URLSearchParams();
    params.set("period", next);
    if (range) {
      params.set("from", range.from);
      params.set("to", range.to);
    }
    router.replace(`${pathname}?${params.toString()}`);
  }

  function handleTabChange(value: string) {
    const next = value as PeriodKey;
    if (next === "custom") {
      setShowCustom(true);
      return;
    }
    setShowCustom(false);
    navigate(next);
  }

  return (
    <div className="flex flex-col gap-3">
      <Tabs value={period} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="week">Week</TabsTrigger>
          <TabsTrigger value="month">Month</TabsTrigger>
          <TabsTrigger value="year">Year</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>
      {showCustom ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-from">From</Label>
            <Input
              id="period-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="period-to">To</Label>
            <Input
              id="period-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="w-40"
            />
          </div>
          <Button
            disabled={!customValid}
            onClick={() =>
              navigate("custom", { from: customFrom, to: customTo })
            }
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  );
}
