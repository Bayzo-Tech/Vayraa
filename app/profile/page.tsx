"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft, Briefcase, MessageCircle, Heart, Wallet, RotateCcw,
  CreditCard, MapPin, UserCircle, Gift, Star, Bell, Info, ChevronRight,
} from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [name, setName] = useState("there");
  const [phone, setPhone] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.name) setName(user.name);
        if (user.phoneNumber) setPhone(user.phoneNumber.replace("+91", ""));
      }
    } catch { }
  }, [mounted]);

  if (!mounted) return (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  // ✅ Functional now — links to a real page/flow
  const quickActions = [
    { icon: Briefcase, label: "Your Orders", href: "/history" },
    { icon: MessageCircle, label: "Help & Support", href: null }, // placeholder — no support page yet
    { icon: Heart, label: "Your Wishlist", href: null }, // placeholder — wishlist not built yet
  ];

  // ✅ Placeholder rows — no destination yet, tapping does nothing (future feature)
  const yourInformation = [
    { icon: RotateCcw, label: "Your Refunds" },
    { icon: Heart, label: "Your Wishlist" },
    { icon: CreditCard, label: "E-Gift Cards" },
    { icon: MessageCircle, label: "Help & Support" },
    { icon: MapPin, label: "Saved Addresses" },
    { icon: UserCircle, label: "Edit Profile" },
    { icon: Gift, label: "Rewards" },
    { icon: CreditCard, label: "Payment Management" },
  ];

  const otherInformation = [
    { icon: Star, label: "Suggest Products" },
    { icon: Bell, label: "Notifications" },
    { icon: Info, label: "General Info" },
  ];

  return (
    <div className="fixed inset-0 bg-gray-50 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 flex-shrink-0 border-b border-gray-100">
        <button onClick={() => router.back()}>
          <ChevronLeft size={22} className="text-black" />
        </button>
        <h1 className="text-lg font-bold text-black">Profile</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-6">

        {/* Avatar + name */}
        <div className="bg-white px-5 pt-5 pb-6 flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-2xl font-bold text-primary">{name.charAt(0).toUpperCase()}</span>
          </div>
          <div>
            <p className="text-lg font-bold text-black">{name}</p>
            {phone && <p className="text-sm text-gray-500">{phone}</p>}
          </div>
        </div>

        {/* Quick actions */}
        <div className="px-4 grid grid-cols-3 gap-3 -mt-1 mb-6">
          {quickActions.map(({ icon: Icon, label, href }) => (
            <button
              key={label}
              onClick={() => href && router.push(href)}
              className="bg-white rounded-2xl border border-gray-100 py-5 px-2 flex flex-col items-center gap-2 shadow-sm"
            >
              <Icon size={22} className="text-black" />
              <span className="text-xs font-semibold text-black text-center leading-tight">{label}</span>
            </button>
          ))}
        </div>

        {/* Money Center — placeholder */}
        <div className="px-4 mb-6">
          <h2 className="text-base font-bold text-black mb-2">Money Center</h2>
          <button className="w-full bg-white rounded-2xl border border-gray-100 px-4 py-4 flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-3">
              <Wallet size={20} className="text-black" />
              <span className="text-sm font-semibold text-black">Vayra Wallet & Gift Card</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="text-sm font-bold text-black">₹0</span>
              <ChevronRight size={16} className="text-gray-400" />
            </span>
          </button>
        </div>

        {/* Your Information */}
        <div className="px-4 mb-6">
          <h2 className="text-base font-bold text-black mb-2">Your Information</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {yourInformation.map(({ icon: Icon, label }, idx) => (
              <button
                key={label}
                className={`w-full flex items-center justify-between px-4 py-3.5 ${idx !== yourInformation.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} className="text-black" />
                  <span className="text-sm font-semibold text-black">{label}</span>
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Other Information */}
        <div className="px-4 mb-6">
          <h2 className="text-base font-bold text-black mb-2">Other Information</h2>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {otherInformation.map(({ icon: Icon, label }, idx) => (
              <button
                key={label}
                className={`w-full flex items-center justify-between px-4 py-3.5 ${idx !== otherInformation.length - 1 ? "border-b border-gray-100" : ""}`}
              >
                <span className="flex items-center gap-3">
                  <Icon size={18} className="text-black" />
                  <span className="text-sm font-semibold text-black">{label}</span>
                </span>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            ))}
          </div>
        </div>

        {/* Logout — goes to Logout Options page */}
        <div className="px-4 mb-4">
          <button
            onClick={() => router.push("/profile/logout")}
            className="w-full bg-white rounded-2xl border border-gray-100 py-3.5 text-center font-bold text-black shadow-sm"
          >
            Log Out
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">App version 1.0.0</p>
      </div>
    </div>
  );
}