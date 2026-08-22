"use client";



import { useEffect, useRef, useState } from "react";

import { ShieldAlert, X } from "lucide-react";

import { AdminButton } from "@/components/ui/admin";

import type { ImpersonationContext } from "@/lib/auth";



type Props = {

  context: ImpersonationContext;

};



const OFFSET_VAR = "--ar360-impersonation-offset";



export default function ImpersonationBanner({ context }: Props) {

  const bannerRef = useRef<HTMLDivElement>(null);

  const [height, setHeight] = useState(44);



  useEffect(() => {

    const el = bannerRef.current;

    if (!el || typeof document === "undefined") return;



    const apply = () => {

      const next = Math.max(40, Math.ceil(el.getBoundingClientRect().height));

      setHeight(next);

      document.documentElement.style.setProperty(OFFSET_VAR, `${next}px`);

      document.documentElement.setAttribute("data-impersonating", "1");

    };



    apply();

    const ro = new ResizeObserver(apply);

    ro.observe(el);

    window.addEventListener("resize", apply);



    return () => {

      ro.disconnect();

      window.removeEventListener("resize", apply);

      document.documentElement.style.removeProperty(OFFSET_VAR);

      document.documentElement.removeAttribute("data-impersonating");

    };

  }, []);



  async function stopImpersonation() {

    const res = await fetch("/api/master-admin/impersonation/stop", { method: "POST" });

    const data = await res.json().catch(() => ({}));

    window.location.href = data.redirectUrl || "/master-admin/customers";

  }



  return (

    <>

      <div

        ref={bannerRef}

        data-impersonation-banner

        className="fixed inset-x-0 top-0 z-[70] flex items-center justify-between gap-3 border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-950"

      >

        <div className="flex min-w-0 items-center gap-2">

          <ShieldAlert size={16} className="shrink-0 text-amber-600" />

          <p className="truncate font-semibold">

            Impersonating <span className="font-black">{context.customerName}</span> ({context.customerUid}) as{" "}

            {context.adminName}

          </p>

        </div>

        <AdminButton size="sm" variant="secondary" onClick={() => void stopImpersonation()}>

          <X size={14} />

          Exit impersonation

        </AdminButton>

      </div>

      {/* Keeps normal dashboard pages from sitting under the fixed banner. */}

      <div aria-hidden className="shrink-0" style={{ height }} />

    </>

  );

}


