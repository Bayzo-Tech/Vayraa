"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // ✅ CHANGED: area/zone screen எப்போதும் கட்டாயம் காட்டணும் —
    // login/session state, saved area எதுவா இருந்தாலும் சரி,
    // splash-க்கு அப்புறம் நேரடியா /area-க்கே போகணும்.
    setTimeout(() => router.replace("/area"), 2000);
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