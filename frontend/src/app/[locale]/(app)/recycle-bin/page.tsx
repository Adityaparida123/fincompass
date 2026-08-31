"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/input";
import { EmptyState } from "@/components/common/shared";
import { useRecycleBin, useRestoreRecycleItem } from "@/hooks/use-api";
import { PageError } from "@/components/charts/responsive-charts";
import { ApiRequestError } from "@/lib/api";
import { Trash2, RotateCcw, Archive } from "lucide-react";
import { CommandHeader } from "@/components/spatial/command-header";
import { GlassPanel } from "@/components/spatial/glass-panel";
import { SpatialBadge } from "@/components/spatial/spatial-badge";

export default function RecycleBinPage() {
  const t = useTranslations("recycleBin");
  const tc = useTranslations("common");
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading, isError, refetch } = useRecycleBin();
  const restore = useRestoreRecycleItem();

  const handleRestore = async (id: number) => {
    setError("");
    try {
      await restore.mutateAsync(id);
      setConfirmId(null);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : tc("error"));
    }
  };

  return (
    <div className="space-y-6 page-transition">
      <CommandHeader
        tag="DECOMMISSIONED ENTITIES"
        title={t("title")}
        subtitle={`${data?.length ?? 0} archived telemetry artifacts available for recovery`}
        action={
          <div className="flex items-center gap-2">
            <SpatialBadge variant="neutral">SOFT PURGE</SpatialBadge>
          </div>
        }
      />

      {error && <p className="text-xs font-mono text-rose-400">{error}</p>}

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}</div>
      ) : isError ? (
        <PageError message={tc("error")} onRetry={() => refetch()} />
      ) : data?.length ? (
        <div className="space-y-2.5">
          {data.map((item) => (
            <GlassPanel key={item.id} hudCorners className="p-4 flex items-center justify-between">
              <div className="min-w-0 flex-1 flex items-center gap-3">
                <div className="rounded-xl bg-surface-container p-2 border border-white/5 text-text-muted">
                  <Archive className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-text-primary capitalize">{item.resource_type.replace(/_/g, " ")}</p>
                    <span className="text-[10px] font-mono text-text-muted">#{item.id}</span>
                  </div>
                  <p className="text-[10px] font-mono text-text-muted mt-0.5">{t("deletedAt")}: {format(new Date(item.deleted_at), "PPp")}</p>
                </div>
              </div>
              {confirmId === item.id ? (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleRestore(item.id)} disabled={restore.isPending} className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-3 text-xs">
                    {tc("confirm")}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmId(null)} className="border-white/10 text-xs text-text-secondary">
                    {tc("cancel")}
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={() => setConfirmId(item.id)} className="border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/10 text-xs font-mono">
                  <RotateCcw className="mr-1.5 h-3 w-3" />{t("restore")}
                </Button>
              )}
            </GlassPanel>
          ))}
        </div>
      ) : (
        <EmptyState title={t("noItems")} description="Deleted records and models will appear here and can be recovered within a 30-day window." icon={Trash2} />
      )}
    </div>
  );
}
