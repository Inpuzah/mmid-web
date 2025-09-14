"use client";

import * as React from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

type Props = {
  name: string;              // server reads with formData.getAll(name)
  label?: string;
  options: string[];
  placeholder?: string;
  defaultSelected?: string[];
};

export default function MultiSelectDropdown({
  name, label, options, placeholder = "Select…", defaultSelected = [],
}: Props) {
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(defaultSelected),
  );

  const toggle = (opt: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(opt) ? next.delete(opt) : next.add(opt);
      return next;
    });

  const clear = () => setSelected(new Set());

  const summary =
    selected.size === 0 ? placeholder : Array.from(selected).join(", ");

  return (
    <div className="grid gap-1">
      {label && <span className="text-sm text-slate-300">{label}</span>}

      {/* hidden inputs so the server receives multiple values */}
      {Array.from(selected).map((v) => (
        <input key={v} type="hidden" name={name} value={v} />
      ))}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="w-full justify-between bg-slate-800 text-slate-100 border-white/10"
          >
            <span className="truncate">{summary}</span>
            <ChevronsUpDown className="h-4 w-4 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-[--radix-dropdown-menu-trigger-width] max-w-[28rem]"
        >
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>{label ?? "Select"}</span>
            {selected.size > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-xs text-slate-500 hover:text-slate-300"
              >
                Clear
              </button>
            )}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <div className="max-h-64 overflow-auto">
            {options.map((opt) => {
              const active = selected.has(opt);
              return (
                <DropdownMenuItem
                  key={opt}
                  onSelect={(e) => { e.preventDefault(); toggle(opt); }}
                  className="pr-8"
                >
                  <span className="truncate">{opt}</span>
                  {active && <Check className="ml-auto h-4 w-4" />}
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <span className="text-xs text-slate-400">
        {selected.size === 0 ? "Choose one or more." : `${selected.size} selected`}
      </span>
    </div>
  );
}
