"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";

export default function ARRedirectPage() {
  const params = useParams();
  const id = String(params.id);

  useEffect(() => {
    window.location.replace(`/viewer/${encodeURIComponent(id)}?openAR=1`);
  }, [id]);

  return (
    <main className="fixed inset-0 grid place-items-center bg-white font-black text-slate-900">
      Opening AR Viewer...
    </main>
  );
}
