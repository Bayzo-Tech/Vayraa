"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Check, Home, Clock, MapPin, Copy, CheckCircle2, Phone, Receipt, ShoppingBag } from "lucide-react";
import { useEffect, useState, Suspense } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

function ConfirmedPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const [amount, setAmount] = useState<number>(0);
  const [items, setItems] = useState<{ name: string; quantity: number; price?: number }[]>([]);

  useEffect(() => {
    setMounted(true);
    const queryOrderId = searchParams.get("orderId");
    const queryAmount = searchParams.get("amount");

    if (queryOrderId) setOrderId(queryOrderId);
    if (queryAmount) setAmount(Number(queryAmount));

    // ✅ REMOVED: this page no longer writes paymentStatus/status to Firestore.
    // That write now happens server-side in /api/verify-payment, only after the
    // Razorpay signature has been verified. This page only reads and displays.

    const effectiveOrderId = queryOrderId || (typeof window !== "undefined" ? sessionStorage.getItem("last_order_id") : null);
    if (effectiveOrderId) {
      const fetchOrderDetails = async () => {
        try {
          const docRef = doc(db, "orders", effectiveOrderId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.totalAmount !== undefined) setAmount(Number(data.totalAmount));
            else if (data.total !== undefined) setAmount(Number(data.total));
            if (data.items) setItems(data.items);
          }
        } catch (e) {
          console.error("Error fetching order details:", e);
        }
      };
      fetchOrderDetails();
    }
  }, [searchParams]);

  const copyToClipboard = () => {
    if (!orderId) return;
    navigator.clipboard.writeText(orderId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center p-6 pt-12 text-center pb-10">

      <div className={`w-24 h-24 bg-[#00C853] rounded-full flex items-center justify-center mb-6 transition-all duration-700 transform shadow-xl shadow-green-200 ${mounted ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}>
        <Check size={48} className="text-white" strokeWidth={3} />
      </div>

      <div className={`transition-all duration-700 delay-200 transform ${mounted ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <h1 className="text-3xl font-black text-black mb-1">Order Confirmed! 🎉</h1>
        <p className="text-gray-500 text-base">Your beach bites are on the way!</p>
      </div>

      <div className={`w-full max-w-sm mt-8 space-y-4 transition-all duration-700 delay-300 transform ${mounted ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>

        {(orderId || amount > 0 || items.length > 0) && (
          <div className="bg-white border border-gray-100 rounded-3xl p-5 text-left shadow-lg">
            <h3 className="font-bold text-black text-sm flex items-center gap-2 mb-3 border-b border-gray-100 pb-2">
              <Receipt size={16} className="text-primary" />
              Order Summary
            </h3>
            <div className="space-y-3">
              {orderId && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Order ID</span>
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-2.5 py-1 rounded-lg">
                    <span className="font-mono font-bold text-xs text-black select-all">
                      {orderId.slice(0, 10)}...
                    </span>
                    <button onClick={copyToClipboard} className="text-primary hover:text-primary/80 transition-colors" title="Copy full Order ID">
                      {copied ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
              )}
              {amount > 0 && (
                <div className="flex justify-between items-center text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-black text-black text-base">₹{amount}</span>
                </div>
              )}
              {items.length > 0 && (
                <div className="border-t border-gray-100 pt-2 space-y-1.5">
                  <p className="text-xs text-gray-500 font-semibold uppercase flex items-center gap-1">
                    <ShoppingBag size={12} /> Items Ordered
                  </p>
                  <div className="max-h-24 overflow-y-auto space-y-1">
                    {items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-black font-medium">{item.name}</span>
                        <span className="text-gray-500 font-bold">x{item.quantity}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="bg-orange-50 border border-orange-100 rounded-3xl p-5 text-left flex items-center justify-between shadow-sm">
          <div>
            <p className="text-xs text-primary font-bold uppercase tracking-wider mb-0.5">Need Help?</p>
            <p className="text-sm font-black text-black">Contact: 9176086204</p>
            <p className="text-[11px] text-gray-500">24/7 Beach Delivery Support</p>
          </div>
          <a href="tel:9176086204" className="w-12 h-12 bg-primary hover:bg-primary/90 text-white rounded-2xl flex items-center justify-center transition-all shadow-md shadow-primary/30 active:scale-95 flex-shrink-0">
            <Phone size={18} />
          </a>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-4 flex items-center gap-4 text-left shadow-sm">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center flex-shrink-0">
            <Clock size={22} className="text-primary" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Estimated Delivery</p>
            <p className="text-lg font-black text-black">20–30 mins</p>
          </div>
        </div>

        <div className="bg-white border border-gray-100 rounded-3xl p-4 flex items-center gap-4 text-left shadow-sm">
          <div className="w-12 h-12 bg-orange-50 rounded-2xl flex items-center justify-center flex-shrink-0">
            <MapPin size={22} className="text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">Delivery To</p>
            <p className="text-base font-bold text-black">Your Beach Location 🏖️</p>
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-3xl p-4 text-center">
          <p className="text-yellow-700 text-xs font-semibold">
            📱 Our delivery partner will call you when they arrive nearby!
          </p>
        </div>

      </div>

      <div className={`w-full max-w-sm mt-8 transition-all duration-700 delay-500 transform ${mounted ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"}`}>
        <button
          onClick={() => router.push("/home")}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 text-lg shadow-lg shadow-primary/30 active:scale-95 transition-all"
        >
          <Home size={20} />
          Back to Home
        </button>
      </div>

    </div>
  );
}

export default function ConfirmedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-500">Loading order confirmation...</p>
        </div>
      }
    >
      <ConfirmedPageContent />
    </Suspense>
  );
}