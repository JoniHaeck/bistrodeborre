"use client";

import { useRouter } from "next/navigation";

export function DagKiezer({ datum, basis }: { datum: string; basis: string }) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      Ga naar dag
      <input
        type="date"
        value={datum}
        onChange={(e) => {
          if (e.target.value) router.push(`${basis}/dag/${e.target.value}`);
        }}
        className="veld !w-auto"
      />
    </label>
  );
}
