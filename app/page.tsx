"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function OnboardingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Check if session cookie exists
    const hasSession = typeof document !== "undefined" && document.cookie.split("; ").some(row => row.trim().startsWith("bayzo_session="));
    
    if (hasSession) {
      setTimeout(() => router.replace("/home"), 2000);
      return;
    }

    // Subscribe to firebase auth state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        setTimeout(() => router.replace("/home"), 2000);
      } else {
        setTimeout(() => router.replace("/area"), 2000);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-teal-900 via-background to-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      <div
        className={`flex flex-col items-center transition-all duration-1000 transform ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
          }`}
      >
        <h1 className="text-6xl font-black text-white tracking-tighter">
          VAY<span className="text-primary">RA</span>
        </h1>
      </div>
    </div>
  );
}
