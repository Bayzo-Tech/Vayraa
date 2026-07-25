"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { ChevronLeft, X } from "lucide-react";
import Image from "next/image";

function IndiaFlag() {
  return (
    <svg width="22" height="15" viewBox="0 0 20 14" className="flex-shrink-0 rounded-sm overflow-hidden">
      <rect width="20" height="4.67" y="0" fill="#FF9933" />
      <rect width="20" height="4.67" y="4.67" fill="#FFFFFF" />
      <rect width="20" height="4.67" y="9.33" fill="#138808" />
      <circle cx="10" cy="7" r="1.6" fill="none" stroke="#000080" strokeWidth="0.3" />
    </svg>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (step === 2) {
      const t = setTimeout(() => otpInputRef.current?.focus(), 100);
      return () => clearTimeout(t);
    }
  }, [step]);

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
        if (data.token) {
          try {
            await signInWithCustomToken(auth, data.token);
          } catch (signInErr) {
            console.error("Firebase custom token sign-in failed:", signInErr);
            setError("Login failed. Please try again.");
            setLoading(false);
            return;
          }
        } else {
          console.error("No token returned from verify-otp API");
          setError("Login failed. Please try again.");
          setLoading(false);
          return;
        }

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

        document.cookie = `bayzo_session=${uid}; path=/; max-age=2592000`;

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
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">

      <div className="px-4 py-3 flex-shrink-0">
        <button
          onClick={() => {
            if (step === 2) { setStep(1); setOtp(""); setError(""); }
            else router.back();
          }}
        >
          <ChevronLeft size={24} className="text-black" />
        </button>
      </div>

      <div className="px-5 pb-2 flex-shrink-0">
        <h1 className="text-xl font-black">
          <span className="text-black">VAY</span><span className="text-primary">RA</span>
        </h1>
      </div>

      {step === 1 ? (
        <div className="flex-1 px-5 pb-6 flex flex-col justify-center min-h-0">
          <h2 className="text-2xl font-black text-black mb-4">Sit, Relax, Enjoy</h2>

          <div className="flex gap-3 mb-5">
            <div className="flex-1 h-28 rounded-2xl overflow-hidden bg-green-50 relative">
              <Image
                src="/images/fresh-produce.jpg"
                alt="Fresh produce"
                fill
                className="object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="flex-1 h-28 rounded-2xl overflow-hidden bg-orange-50 relative">
              <Image
                src="/images/beach-food.jpg"
                alt="Beach food"
                fill
                className="object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
            <div className="flex-1 h-28 rounded-2xl overflow-hidden bg-amber-50 relative">
              <Image
                src="/images/delivery.jpg"
                alt="Delivery"
                fill
                className="object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3.5 py-3 mb-4 focus-within:border-primary transition-colors">
            <IndiaFlag />
            <span className="text-base font-medium text-black">+91</span>
            <div className="w-px h-4 bg-gray-200" />
            <input
              type="tel"
              value={phone}
              onChange={e => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 10)); setError(""); }}
              placeholder="Enter mobile number"
              className="flex-1 bg-transparent text-base text-black outline-none placeholder:text-gray-400"
              maxLength={10}
            />
          </div>

          {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

          <button
            onClick={handleSendOTP}
            disabled={loading || phone.length !== 10}
            className="w-full bg-primary disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm active:scale-95 transition-all mb-3"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : "Login"}
          </button>

          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            By tapping, I accept the{" "}
            <button onClick={() => setShowTermsModal(true)} className="underline text-gray-500">
              Privacy Policy
            </button>
            , VAYRA Terms of Use
          </p>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="relative w-full flex-shrink-0" style={{ height: "35vh" }}>
            <Image
              src="/images/otp-illustration.jpg"
              alt="Delivery illustration"
              fill
              className="object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>

          <div className="px-5 py-5 flex-1 flex flex-col justify-center min-h-0">
            <h2 className="text-lg font-black text-black mb-1">OTP Verification</h2>
            <p className="text-xs text-gray-500 mb-5">
              OTP has been sent to +91 {phone}{" "}
              <button
                onClick={() => { setStep(1); setOtp(""); setError(""); }}
                className="text-primary underline"
              >
                edit
              </button>
            </p>

            <div className="relative mb-3">
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`flex-1 aspect-square rounded-xl flex items-center justify-center text-lg font-bold text-black ${
                      i === otp.length
                        ? "border-2 border-primary bg-white"
                        : otp[i]
                        ? "border border-gray-200 bg-white"
                        : "bg-gray-50 border border-gray-100"
                    }`}
                  >
                    {otp[i] || ""}
                  </div>
                ))}
              </div>
              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                value={otp}
                onChange={e => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
                maxLength={6}
                autoFocus
                className="absolute inset-0 w-full h-full opacity-0 text-base tracking-widest"
              />
            </div>

            {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

            <button
              onClick={handleSendOTP}
              className="text-primary text-xs font-semibold mb-4 self-start"
            >
              Resend OTP
            </button>

            <button
              onClick={handleVerifyOTP}
              disabled={loading || otp.length !== 6}
              className="w-full bg-primary disabled:opacity-50 text-white font-bold py-3.5 rounded-xl text-sm active:scale-95 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : "Verify and Proceed"}
            </button>
          </div>
        </div>
      )}

      {showTermsModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-black">Privacy Policy & Terms</h3>
              <button onClick={() => setShowTermsModal(false)}>
                <X size={22} className="text-black" />
              </button>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed">
              This is a placeholder for your Privacy Policy and Terms of Use document.
              Replace this text block with your actual policy content, or link to an
              uploaded PDF/document once it&apos;s ready.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}