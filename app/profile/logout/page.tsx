"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

export default function LogoutOptionsPage() {
  const router = useRouter();
  const [showConfirm, setShowConfirm] = useState(false);

  // ✅ Same logout logic as before (moved here from home page's dropdown menu)
  const handleConfirmLogout = () => {
    try {
      localStorage.removeItem("user");
      localStorage.removeItem("bayzo_area");
      localStorage.removeItem("bayzo_zone");
      document.cookie = "bayzo_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch { }
    router.push("/area");
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-hidden">

      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-3 flex-shrink-0 border-b border-gray-100">
        <button onClick={() => router.back()}>
          <ChevronLeft size={22} className="text-black" />
        </button>
        <h1 className="text-lg font-bold text-black">Logout Options</h1>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-gray-50 px-4 py-2">
          <p className="text-xs font-semibold text-gray-400 tracking-wide">CURRENT DEVICE</p>
        </div>
        <div className="bg-white px-4 py-4 flex items-center justify-between border-b border-gray-100">
          <div>
            <p className="text-base font-semibold text-black">This device</p>
            <p className="text-sm text-gray-400">Active now</p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="text-primary font-bold text-sm tracking-wide"
          >
            LOGOUT
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-6">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <p className="text-lg font-bold text-black mb-4">Are you sure you want to logout?</p>
            <div className="flex gap-3">
              <button
                onClick={handleConfirmLogout}
                className="flex-1 bg-primary text-white font-bold py-3 rounded-xl active:scale-95 transition-all"
              >
                Yes
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-primary/10 text-primary font-bold py-3 rounded-xl active:scale-95 transition-all"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}