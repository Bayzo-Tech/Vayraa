"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Package, MapPin, Phone, Copy, CheckCircle2, Clock } from "lucide-react";
import ReviewModal from "@/components/ReviewModal"; // ✅ NEW

const STATUS_STEPS = [
  { key: "placed", label: "Order Placed 🛒", desc: "Your order has been placed" },
  { key: "preparing", label: "Preparing 👨‍🍳", desc: "Vendor is preparing your food" },
  { key: "out_for_delivery", label: "Out for Delivery 🛵", desc: "Delivery partner is on the way" },
  { key: "delivered", label: "Delivered ✅", desc: "Enjoy your meal!" },
];

const getStepIndex = (status: string) => {
  const map: Record<string, number> = {
    placed: 0,
    preparing: 1,
    ready_for_pickup: 1,
    out_for_delivery: 2,
    delivered: 3,
    cancelled: -1,
  };
  return map[status] ?? 0;
};

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<Record<string, unknown> & { id?: string; orderStatus?: string; cancelledBy?: string; deliveryPartnerName?: string; deliveryPartnerPhone?: string; razorpayPaymentId?: string; itemTotal?: number; totalAmount?: number; deliveryFee?: number; packingFee?: number; location?: { area: string; zone: string }; items?: Array<{ name: string; quantity: number; price: number }>; vendorId?: string; stallName?: string; reviewed?: boolean } | null>(null); // ✅ NEW: added vendorId, stallName, reviewed to type
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false); // ✅ NEW

  // ✅ Real-time onSnapshot
  useEffect(() => {
    if (!orderId) return;
    const unsub = onSnapshot(doc(db, "orders", orderId), (snap) => {
      if (snap.exists()) {
        setOrder({ id: snap.id, ...snap.data() });
      }
      setLoading(false);
    });
    return () => unsub();
  }, [orderId]);

  const copyPaymentId = () => {
    if (!order?.razorpayPaymentId) return;
    navigator.clipboard.writeText(order.razorpayPaymentId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ✅ OTP verify — customer enters OTP from delivery boy
  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { setOtpError("Enter 6-digit OTP"); return; }
    setOtpLoading(true);
    setOtpError("");
    try {
      const res = await fetch("/api/verify-delivery-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, otp }),
      });
      const data = await res.json();
      if (data.success) {
        setOtpSuccess(true);
        setOtp("");
      } else {
        setOtpError(data.message || "Invalid OTP. Try again.");
      }
    } catch {
      setOtpError("Network error. Try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  if (!order) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
      <Package size={48} className="text-muted mb-4" />
      <h2 className="text-xl font-bold text-foreground mb-2">Order not found</h2>
      <button onClick={() => router.push("/home")} className="mt-4 bg-primary text-white px-6 py-3 rounded-xl font-bold">
        Go Home
      </button>
    </div>
  );

  const currentStep = getStepIndex(order.orderStatus ?? "");
  const isCancelled = order.orderStatus === "cancelled";
  const isDelivered = order.orderStatus === "delivered";
  const isOutForDelivery = order.orderStatus === "out_for_delivery";

  return (
    <div className="min-h-screen bg-background flex flex-col pb-10">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => router.back()} className="p-2 bg-card rounded-full border border-border">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Track Order</h1>
          <p className="text-xs text-muted">#{orderId.slice(0, 8).toUpperCase()}</p>
        </div>
      </div>

      <div className="p-4 space-y-4">

        {/* Status Timeline */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold text-foreground mb-4">Order Status</h2>

          {isCancelled ? (
            <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl p-4">
              <span className="text-2xl">❌</span>
              <div>
                <p className="text-red-500 font-bold">Order Cancelled</p>
                {order.cancelledBy && (
                  <p className="text-red-400 text-xs mt-0.5">
                    Cancelled by: {order.cancelledBy === 'vendor' ? '🏪 Vendor' : order.cancelledBy === 'delivery' ? '🛵 Delivery Partner' : '👤 Customer'}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-0">
              {STATUS_STEPS.map((step, idx) => {
                const isDone = idx <= currentStep;
                const isActive = idx === currentStep;
                const isLast = idx === STATUS_STEPS.length - 1;
                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 ${isActive ? 'border-primary bg-primary/20 scale-110' : isDone ? 'border-green-500 bg-green-500/20' : 'border-border bg-card'}`}>
                        {isDone && !isActive ? (
                          <CheckCircle2 size={16} className="text-green-500" />
                        ) : isActive ? (
                          <div className="w-3 h-3 rounded-full bg-primary animate-pulse" />
                        ) : (
                          <div className="w-2 h-2 rounded-full bg-muted" />
                        )}
                      </div>
                      {!isLast && (
                        <div className={`w-0.5 h-8 mt-1 rounded-full ${idx < currentStep ? 'bg-green-500' : 'bg-border'}`} />
                      )}
                    </div>
                    <div className={`pb-6 flex-1 ${isLast ? 'pb-0' : ''}`}>
                      <p className={`font-semibold text-sm ${isActive ? 'text-primary' : isDone ? 'text-foreground' : 'text-muted'}`}>
                        {step.label}
                      </p>
                      <p className={`text-xs mt-0.5 ${isActive ? 'text-muted' : isDone ? 'text-muted' : 'text-muted/50'}`}>
                        {step.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ✅ OTP Box — shows when delivery boy sends OTP to customer */}
        {isOutForDelivery && !isDelivered && !otpSuccess && (
          <div className="bg-card border-2 border-primary/50 rounded-2xl p-5 shadow-[0_0_20px_rgba(255,102,0,0.1)]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">🔐</span>
              <div>
                <p className="font-bold text-foreground text-sm">Enter Delivery OTP</p>
                <p className="text-muted text-xs">Your delivery partner will share the OTP</p>
              </div>
            </div>
            <input
              type="text"
              inputMode="numeric"
              className="w-full bg-background border border-border focus:border-primary rounded-xl px-4 py-3 text-foreground text-center text-2xl tracking-[0.5em] font-mono outline-none transition-colors mb-3"
              placeholder="— — — — — —"
              value={otp}
              onChange={e => { setOtp(e.target.value.replace(/\D/g, '').slice(0, 6)); setOtpError(''); }}
              maxLength={6}
            />
            {otpError && <p className="text-red-500 text-xs text-center mb-2">{otpError}</p>}
            <button
              onClick={handleVerifyOTP}
              disabled={otp.length !== 6 || otpLoading}
              className="w-full bg-primary disabled:opacity-50 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all"
            >
              {otpLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                "✅ Verify & Confirm Delivery"
              )}
            </button>
          </div>
        )}

        {/* OTP Success */}
        {otpSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-green-500 font-bold">Order Delivered!</p>
            <p className="text-muted text-xs mt-1">Thank you for ordering with Vayra!</p>
          </div>
        )}

        {/* Delivered success */}
        {isDelivered && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center">
            <p className="text-3xl mb-2">🎉</p>
            <p className="text-green-500 font-bold text-lg">Order Delivered!</p>
            <p className="text-muted text-xs mt-1">Enjoy your beach food!</p>
          </div>
        )}

        {/* ✅ NEW: Write Review button — shows only after delivery, and only once */}
        {isDelivered && !order.reviewed && order.vendorId && (
          <button
            onClick={() => setShowReviewModal(true)}
            className="w-full bg-card border-2 border-primary text-primary font-bold py-3.5 rounded-2xl active:scale-95 transition-transform"
          >
            ⭐ Write a Review
          </button>
        )}

        {/* Delivery Partner Info */}
        {order.deliveryPartnerName && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">🛵 Delivery Partner</p>
            <p className="text-foreground font-bold">{order.deliveryPartnerName}</p>
            {order.deliveryPartnerPhone && (
              <a href={`tel:${order.deliveryPartnerPhone}`} className="text-primary text-sm flex items-center gap-1 mt-1">
                <Phone size={13} /> {order.deliveryPartnerPhone}
              </a>
            )}
          </div>
        )}

        {/* Order Details */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
            <Package size={16} className="text-primary" /> Order Details
          </h2>
          <div className="space-y-2 mb-4">
            {order.items?.map((item: { name: string; quantity: number; price: number }, idx: number) => (
              <div key={idx} className="flex justify-between items-center py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-primary text-xs font-bold bg-primary/10 px-1.5 py-0.5 rounded">{item.quantity}x</span>
                  <span className="text-foreground text-sm">{item.name}</span>
                </div>
                <span className="text-foreground text-sm font-semibold">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">Item Total</span>
              <span className="text-foreground">₹{order.itemTotal || order.totalAmount}</span>
            </div>
            {(order.deliveryFee ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Delivery Fee</span>
                <span className="text-foreground">₹{order.deliveryFee}</span>
              </div>
            )}
            {(order.packingFee ?? 0) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted">Packing Fee</span>
                <span className="text-foreground">₹{order.packingFee}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base pt-1 border-t border-border">
              <span className="text-foreground">Total Amount</span>
              <span className="text-foreground">₹{order.totalAmount}</span>
            </div>
          </div>
        </div>

        {/* Location */}
        {order.location && (
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <MapPin size={18} className="text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted">Delivery Location</p>
              <p className="text-foreground font-semibold text-sm">{order.location.area} — {order.location.zone}</p>
            </div>
          </div>
        )}

        {/* Payment ID */}
        {order.razorpayPaymentId && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs text-muted uppercase tracking-wider mb-2">Payment ID</p>
            <div className="flex items-center justify-between bg-background border border-border rounded-xl px-3 py-2.5">
              <span className="font-mono text-xs text-foreground">{order.razorpayPaymentId}</span>
              <button onClick={copyPaymentId} className="text-primary ml-2 flex-shrink-0">
                {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        )}

        {/* Estimated time */}
        {!isDelivered && !isCancelled && (
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-500/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-muted">Estimated Delivery</p>
              <p className="text-foreground font-bold">20–30 mins</p>
            </div>
          </div>
        )}

        {/* Back to Home */}
        <button
          onClick={() => router.push("/home")}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl active:scale-95 transition-all"
        >
          🏠 Back to Home
        </button>

      </div>

      {/* ✅ NEW: Review Modal */}
      {showReviewModal && order.vendorId && (
        <ReviewModal
          orderId={orderId}
          vendorId={order.vendorId}
          stallName={order.stallName || "the vendor"}
          onClose={() => setShowReviewModal(false)}
          onSubmitted={() => setShowReviewModal(false)}
        />
      )}

    </div>
  );
}