"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const [mounted, setMounted] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // ✅ Problem 5 Fix: Already logged in? Redirect to home
  useEffect(() => {
    setMounted(true);
    const hasSession = typeof document !== "undefined" && document.cookie.split("; ").some(row => row.trim().startsWith("bayzo_session="));
    if (hasSession) {
      router.replace("/home");
      return;
    }

    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        router.replace("/home");
      } else {
        setCheckingAuth(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (phone.length !== 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (data.success) {
        setStep(2);
      } else {
        setError(data.message || "Failed to send OTP. Please try again.");
      }
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);
    if (value && index < 5) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      setError("Please enter the complete 6-digit OTP.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: otpString }),
      });
      const data = await res.json();
      if (data.success) {
        // ✅ Firebase sign in
        await signInWithCustomToken(auth, data.token);

        // ✅ Set session cookie so middleware knows user is logged in
        document.cookie = `bayzo_session=${data.token}; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;

        if (mounted && typeof window !== "undefined") {
          try {
            localStorage.setItem("bayzo_token", data.token);
            localStorage.setItem("user", JSON.stringify({ uid: data.uid, phone }));
          } catch (e) {
            console.error(e);
          }
        }

        if (data.profileComplete) {
          router.replace("/home");
        } else {
          router.replace("/basic-details");
        }
      } else {
        setError(data.message || "Invalid OTP. Please try again.");
      }
    } catch {
      setError("An error occurred during verification. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <button
        onClick={() => (step === 2 ? setStep(1) : router.back())}
        className="mt-4 mb-8 w-fit focus:outline-none"
      >
        <ArrowLeft size={24} className="text-foreground" />
      </button>

      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Welcome Back</h1>

        {step === 1 ? (
          <p className="text-muted mb-10">Enter your phone number to login or register</p>
        ) : (
          <p className="text-muted mb-10">Enter the 6-digit OTP sent to your phone</p>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 px-4 py-3 rounded-xl mb-6 text-sm text-center">
            {error}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-6">
            <div className="flex items-center bg-card border-2 border-border rounded-2xl h-16 px-4 focus-within:border-primary transition-all">
              <span className="text-2xl mr-2">🇮🇳</span>
              <span className="text-muted font-bold text-sm mr-2">IN</span>
              <span className="text-foreground font-semibold text-lg mr-3">+91</span>
              <div className="w-px h-8 bg-border mr-3" />
              <input
                type="tel"
                maxLength={10}
                className="flex-1 bg-transparent text-foreground text-lg focus:outline-none placeholder:text-muted"
                placeholder="Enter number"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                disabled={loading}
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || phone.length !== 10}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-lg shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                "Send OTP"
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-8">
            <p className="text-sm text-muted -mt-4">
              OTP sent to{" "}
              <span className="text-foreground font-semibold">+91 {phone}</span>
            </p>

            <div className="grid grid-cols-6 gap-2 w-full">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={`w-full aspect-square text-center text-xl font-bold rounded-lg border-2 bg-card text-foreground focus:outline-none transition-all ${digit ? "border-primary" : "border-border"
                    } focus:border-primary`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => {
                setStep(1);
                setOtp(["", "", "", "", "", ""]);
                setError("");
              }}
              className="text-sm text-primary font-medium"
            >
              Resend OTP
            </button>

            <button
              type="submit"
              disabled={loading || otp.join("").length !== 6}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-lg shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                "Verify OTP"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}