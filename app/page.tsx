"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";

export default function OnboardingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setMounted(true);

    // Check if session cookie exists
    const hasSession = typeof document !== "undefined" && document.cookie.split("; ").some(row => row.trim().startsWith("bayzo_session="));
    
    if (hasSession) {
      router.replace("/home");
      return;
    }

    // Subscribe to firebase auth state
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        router.replace("/home");
      } else {
        setLoading(false);
        // Automatically redirect to login after 2 seconds only if not logged in
        const timer = setTimeout(() => {
          router.replace("/login");
        }, 2000);
        return () => clearTimeout(timer);
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return null; // Skipping splash completely for logged-in users
  }

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
