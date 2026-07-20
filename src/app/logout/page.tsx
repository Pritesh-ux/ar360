"use client";

import { useEffect } from "react";

export default function LogoutPage() {
  useEffect(() => {
    localStorage.removeItem("ar360_current_user");
    localStorage.removeItem("ar_logged_in");
    sessionStorage.clear();

    window.location.href = "/logout/clear";
  }, []);

  return (
    <main className="grid min-h-screen place-items-center bg-slate-100 text-slate-950">
      <p className="font-black">Logging out...</p>
    </main>
  );
}