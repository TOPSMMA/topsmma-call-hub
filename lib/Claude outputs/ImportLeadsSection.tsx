"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ImportLeadsForm from "@/components/ImportLeadsForm";

type Rep = { id: string; full_name: string };

export default function ImportLeadsSection({ reps }: { reps: Rep[] }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3.5">
      <div className="flex justify-end">
        <button
          onClick={() => setOpen((v) => !v)}
          className="bg-accent hover:bg-accentlight transition-colors text-white font-bold text-[12.5px] rounded-lg px-4 py-2"
        >
          {open ? "Close import" : "+ Import CSV"}
        </button>
      </div>
      {open && (
        <ImportLeadsForm
          reps={reps}
          onClose={() => setOpen(false)}
          onImported={() => router.refresh()}
        />
      )}
    </div>
  );
}
