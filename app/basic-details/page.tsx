"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { ArrowLeft } from "lucide-react";

function BasicDetailsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/home";
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

      router.push(redirect);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save. Please try again.";
      setErrors({ form: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col p-6">
      <button onClick={() => router.back()} className="mt-4 mb-8 w-fit">
        <ArrowLeft size={24} className="text-foreground" />
      </button>

      <div className="flex-1">
        <h1 className="text-3xl font-bold mb-2 text-foreground">Basic Details</h1>
        <p className="text-muted mb-8">Tell us a bit about yourself</p>

        {errors.form && (
          <div className="bg-red-500/10 border border-red-500 text-red-400 p-3 rounded-xl mb-6 text-sm">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors({ ...errors, name: undefined }); }}
              className="w-full bg-card border border-border rounded-xl h-14 px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-lg text-foreground"
              placeholder="Enter your name"
            />
            {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
          </div>

          {/* Age */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Age</label>
            <input
              type="number"
              value={age}
              onChange={(e) => { setAge(e.target.value); setErrors({ ...errors, age: undefined }); }}
              className="w-full bg-card border border-border rounded-xl h-14 px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-lg text-foreground"
              placeholder="Enter your age"
              min="10" max="100"
            />
            {errors.age && <p className="text-red-400 text-sm mt-1">{errors.age}</p>}
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Gender</label>
            <div className="flex gap-3">
              {["Male", "Female", "Other"].map((g) => (
                <button key={g} type="button"
                  onClick={() => { setGender(g); setErrors({ ...errors, gender: undefined }); }}
                  className={`flex-1 py-3 rounded-xl border font-medium transition-all ${gender === g
                    ? "bg-primary/20 border-primary text-primary"
                    : "bg-card border-border text-foreground"
                    }`}>
                  {g}
                </button>
              ))}
            </div>
            {errors.gender && <p className="text-red-400 text-sm mt-1">{errors.gender}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2 text-foreground">Email ID (Optional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors({ ...errors, email: undefined }); }}
              className="w-full bg-card border border-border rounded-xl h-14 px-4 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-lg text-foreground"
              placeholder="Enter your email"
            />
            {errors.email && <p className="text-red-400 text-sm mt-1">{errors.email}</p>}
          </div>

          <button type="submit" disabled={loading}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-lg shadow-lg active:scale-95 transition-all disabled:opacity-50 mt-4">
            {loading ? "Saving..." : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function BasicDetailsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <BasicDetailsPageContent />
    </Suspense>
  );
}