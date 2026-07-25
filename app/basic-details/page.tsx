"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ChevronLeft } from "lucide-react";

function BasicDetailsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{
    name?: string; age?: string; gender?: string; email?: string; form?: string;
  }>({});

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const newErrors: typeof errors = {};
    if (!name.trim()) newErrors.name = "Full name is required";
    if (!age) {
      newErrors.age = "Age is required";
    } else {
      const ageNum = parseInt(age, 10);
      if (isNaN(ageNum) || ageNum < 10 || ageNum > 100)
        newErrors.age = "Please enter a valid age";
    }
    if (!gender) newErrors.gender = "Please select your gender";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      newErrors.email = "Please enter a valid email";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      // Get uid from localStorage or Firebase auth
      let userStr = null;
      if (mounted && typeof window !== "undefined") {
        try {
          userStr = localStorage.getItem("user");
        } catch (e) {
          console.error(e);
        }
      }
      const localUser = userStr ? JSON.parse(userStr) : {};
      const uid = localUser.uid || auth.currentUser?.uid;

      if (!uid) throw new Error("Session expired. Please login again.");

      const userDetails = {
        name: name.trim(),
        age: parseInt(age, 10),
        gender,
        email: email.trim(),
        profileComplete: true,
        updatedAt: serverTimestamp(),
      };

      // ✅ Save to Firestore
      await setDoc(doc(db, "users", uid), userDetails, { merge: true });

      // ✅ Update localStorage
      if (mounted && typeof window !== "undefined") {
        try {
          localStorage.setItem("user", JSON.stringify({
            ...localUser,
            ...userDetails,
            profileComplete: true,
          }));
        } catch (e) {
          console.error(e);
        }
      }

      router.push(searchParams.get("redirect") || "/home");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    // ✅ CHANGED: fixed inset-0 + overflow-y-auto (same fixed-viewport pattern as login/OTP
    // pages) — page can't scroll behind the keyboard, but the form itself scrolls internally
    // if content ever exceeds screen height (e.g. small phones + keyboard open)
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">

      {/* Header — back button + VAYRA wordmark, same as login/OTP pages */}
      <div className="px-4 py-3 flex-shrink-0">
        <button onClick={() => router.back()}>
          <ChevronLeft size={24} className="text-black" />
        </button>
      </div>
      <div className="px-5 pb-2 flex-shrink-0">
        <h1 className="text-xl font-black">
          <span className="text-black">VAY</span><span className="text-primary">RA</span>
        </h1>
      </div>

      <div className="flex-1 px-5 pb-6 overflow-y-auto min-h-0">
        <h2 className="text-2xl font-black text-black mb-1">Basic Details</h2>
        <p className="text-sm text-gray-500 mb-6">Tell us a bit about yourself</p>

        {errors.form && (
          <div className="bg-red-50 border border-red-300 text-red-600 p-3 rounded-xl mb-5 text-sm">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-black">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: undefined }); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl h-14 px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base text-black placeholder:text-gray-400"
              placeholder="Enter your name"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-black">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => { setAge(e.target.value); setErrors({ ...errors, age: undefined }); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl h-14 px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base text-black placeholder:text-gray-400"
              placeholder="Enter your age"
              min="10" max="100"
            />
            {errors.age && <p className="text-red-500 text-xs mt-1">{errors.age}</p>}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-black">Gender</label>
            <div className="flex gap-2.5">
              {["Male", "Female", "Other"].map((g) => (
                <button key={g} type="button"
                  onClick={() => { setGender(g); setErrors({ ...errors, gender: undefined }); }}
                  className={`flex-1 py-3 rounded-xl border font-semibold text-sm transition-all ${gender === g
                    ? "bg-white border-primary text-primary"
                    : "bg-white border-gray-200 text-black"
                    }`}>
                  {g}
                </button>
              ))}
            </div>
            {errors.gender && <p className="text-red-500 text-xs mt-1">{errors.gender}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1.5 text-black">Email ID (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: undefined }); }}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl h-14 px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-base text-black placeholder:text-gray-400"
              placeholder="Enter your email"
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl text-sm active:scale-95 transition-all disabled:opacity-50 mt-2">
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
            ) : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BasicDetailsPage() {
  return (
    <Suspense fallback={
      <div className="fixed inset-0 bg-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BasicDetailsPageContent />
    </Suspense>
  );
}