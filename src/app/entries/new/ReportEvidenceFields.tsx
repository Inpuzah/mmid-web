"use client";

import { Check } from "lucide-react";
import { useMemo, useState } from "react";
import EvidenceRow from "@/components/reports/EvidenceRow";

type Row = { id: string; value: string };

function makeRow() {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, value: "" };
}

export default function ReportEvidenceFields() {
  const [replayRows, setReplayRows] = useState<Row[]>([makeRow()]);
  const [videoRows, setVideoRows] = useState<Row[]>([makeRow()]);
  const [files, setFiles] = useState<File[]>([]);

  const hasValidEvidence = useMemo(() => {
    const hasReplay = replayRows.some((row) => row.value.trim().length > 0);
    const hasVideo = videoRows.some((row) => row.value.trim().length > 0);
    const hasFiles = files.length > 0;
    return hasReplay || hasVideo || hasFiles;
  }, [replayRows, videoRows, files]);

  const updateRow = (rows: Row[], id: string, value: string) =>
    rows.map((row) => (row.id === id ? { ...row, value } : row));

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <section className="space-y-3 rounded-[3px] border border-slate-700/70 bg-slate-950/70 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Hypixel Replay IDs</h3>
          <button
            type="button"
            onClick={() => setReplayRows((prev) => [...prev, makeRow()])}
            className="px-2 py-1 text-xs rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Add Replay ID
          </button>
        </div>
        <div className="space-y-2">
          {replayRows.map((row) => (
            <div key={row.id} className="space-y-1.5">
              <input
                name="replayIds"
                value={row.value}
                onChange={(event) => setReplayRows((prev) => updateRow(prev, row.id, event.target.value))}
                placeholder="Replay ID"
                className="w-full px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 text-sm"
              />
              {row.value.trim() ? (
                <EvidenceRow
                  label="Replay ID"
                  value={row.value.trim()}
                  onRemove={() => setReplayRows((prev) => prev.filter((item) => item.id !== row.id))}
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-[3px] border border-slate-700/70 bg-slate-950/70 p-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">YouTube / Video Links</h3>
          <button
            type="button"
            onClick={() => setVideoRows((prev) => [...prev, makeRow()])}
            className="px-2 py-1 text-xs rounded border border-slate-600 text-slate-200 hover:bg-slate-800"
          >
            Add Video Link
          </button>
        </div>
        <div className="space-y-2">
          {videoRows.map((row) => (
            <div key={row.id} className="space-y-1.5">
              <input
                name="videoLinks"
                value={row.value}
                onChange={(event) => setVideoRows((prev) => updateRow(prev, row.id, event.target.value))}
                placeholder="https://youtube.com/..."
                className="w-full px-3 py-2 rounded-[3px] border-2 border-black/80 bg-slate-950/80 text-slate-100 text-sm"
              />
              {row.value.trim() ? (
                <EvidenceRow
                  label="Video Link"
                  value={row.value.trim()}
                  onRemove={() => setVideoRows((prev) => prev.filter((item) => item.id !== row.id))}
                />
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-[3px] border border-slate-700/70 bg-slate-950/70 p-3 md:col-span-2">
        <h3 className="text-sm font-semibold text-slate-200">Attach Files</h3>
        <input
          name="evidenceFiles"
          type="file"
          multiple
          onChange={(event) => setFiles(Array.from(event.currentTarget.files ?? []))}
          className="w-full text-sm text-slate-200 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:text-slate-100 hover:file:bg-slate-600"
        />
        {files.length > 0 ? (
          <ul className="space-y-1">
            {files.map((file) => (
              <li
                key={`${file.name}-${file.size}`}
                className="rounded-[3px] border border-slate-700/80 bg-slate-900/60 px-2.5 py-2 text-sm text-slate-100"
              >
                {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
              </li>
            ))}
          </ul>
        ) : null}
        <p className="text-xs text-slate-400">
          At least one replay ID, video link, or file attachment is required.
        </p>
        {hasValidEvidence ? (
          <div className="inline-flex items-center gap-1 rounded-[3px] border border-emerald-400/60 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-200">
            <Check className="h-3.5 w-3.5" /> Evidence requirement satisfied
          </div>
        ) : null}
      </section>
    </div>
  );
}
