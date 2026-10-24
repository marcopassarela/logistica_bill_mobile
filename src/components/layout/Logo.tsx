"use client";

import { useState } from "react";
import Image from "next/image";

export function Logo({ className = "h-10 w-10" }: { className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`flex items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-lg ${className}`}
      >
        LB
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-lg bg-primary/10 ${className}`}>
      <Image
        src="/logo.png"
        alt="Logísticas Bill"
        fill
        className="object-contain p-0.5"
        onError={() => setFailed(true)}
        priority
      />
    </div>
  );
}
