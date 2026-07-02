"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const redirectTo = searchParams.get("redirect") || "/home";

  const handleSendOTP = async () => {
    if (phone.length !== 10) { setError("Enter valid 10-digit number"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) { setStep(2); }
      else setError(data.message || "Failed to send OTP");
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setError("Enter 6-digit OTP"); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp }),
      });
      const data = await res.json();
      if (data.success) {
        // Save user to localStorage
        const uid = `91${phone}`;
        let profileComplete = false;
        try {
          const userSnap = await getDoc(doc(db, "users", uid));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            profileComplete = !!(userData.name && userData.name.trim());
            localStorage.setItem("user", JSON.stringify({
              uid,
              phoneNumber: `+91${phone}`,
              name: userData.name || "",
              profileComplete,
            }));
          } else {
            localStorage.setItem("user", JSON.stringify({
              uid,
              phoneNumber: `+91${phone}`,
              name: "",
              profileComplete: false,
            }));
          }
        } catch {
          localStorage.setItem("user", JSON.stringify({
            uid,
            phoneNumber: `+91${phone}`,
            name: "",
            profileComplete: false,
          }));
        }

        // Set session cookie
        document.cookie = `bayzo_session=${uid}; path=/; max-age=2592000`;

        // ✅ Redirect logic
        if (profileComplete) {
          router.replace(redirectTo);
        } else {
          router.replace(`/basic-details?redirect=${encodeURIComponent(redirectTo)}`);
        }
      } else {
        setError(data.message || "Invalid OTP");
      }
    } catch { setError("Network error. Try again."); }
    finally { setLoading(false); }
  };

  if (!mounted) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-foreground">
            VAY<span className="text-primary">RA</span>
          </h1>
          <p className="text-muted text-sm mt-2">Beach Food Delivery</p>
        </div>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-lg">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Enter your number</h2>
                <p className="text-muted text-sm">We'll send you a verification code</p>
              </div>
              <div className="flex items-center bg-background border border-border rounded-xl overflow-hidden focus-within:border-primary transition-colors">
                <span className="px-3 py-3 text-muted text-sm border-r border-border">+91</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
                  placeholder="Mobile Number"
                  className="flex-1 bg-transparent px-3 py-3 text-foreground text-sm outline-none placeholder:text-muted"
                  maxLength={10}
                />
              </div>
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={handleSendOTP}
                disabled={loading || phone.length !== 10}
                className="w-full bg-primary disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm active:scale-95 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : "Send OTP →"}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <button
                  onClick={() => { setStep(1); setOtp(""); setError(""); }}
                  className="text-muted text-sm mb-3 flex items-center gap-1"
                >
                  ← Change number
                </button>
                <h2 className="text-xl font-bold text-foreground mb-1">Enter OTP</h2>
                <p className="text-muted text-sm">Sent to +91 {phone}</p>
              </div>
              <input
                type="text"
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                placeholder="— — — — — —"
                className="w-full bg-background border border-border focus:border-primary rounded-xl px-4 py-3 text-foreground text-center text-2xl tracking-[0.5em] font-mono outline-none transition-colors"
                maxLength={6}
                autoFocus
              />
              {error && <p className="text-red-500 text-xs">{error}</p>}
              <button
                onClick={handleVerifyOTP}
                disabled={loading || otp.length !== 6}
                className="w-full bg-primary disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm active:scale-95 transition-all"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                ) : "Verify OTP ✓"}
              </button>
              <button
                onClick={handleSendOTP}
                className="w-full text-primary text-sm font-medium py-2"
              >
                Resend OTP
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}