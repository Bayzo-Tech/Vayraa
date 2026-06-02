"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import { ArrowLeft, Check, Copy, CheckCircle2, Phone } from "lucide-react";

interface OrderItem {
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
}

interface OrderData {
  items: OrderItem[];
  itemTotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentId: string;
  orderStatus: string;
  deliveryPartnerPhone?: string;
  customerPhone?: string;
}

const STEPS = [
  { id: "placed", label: "Order Placed 🛒" },
  { id: "preparing", label: "Preparing 👨‍🍳" },
  { id: "out for delivery", label: "Out for Delivery 🏃" },
  { id: "delivered", label: "Delivered ✅" },
];

export default function OrderTrackingPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [otpDigits, setOtpDigits] = useState(["", "", "", ""]);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState(false);

  useEffect(() => {
    if (!orderId) return;
    const unsubscribe = onSnapshot(doc(db, "orders", orderId), (docSnap) => {
      if (docSnap.exists()) {
        setOrder(docSnap.data() as OrderData);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [orderId]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpDigits];
    newOtp[index] = value.slice(-1);
    setOtpDigits(newOtp);
    if (value && index < 3) {
      document.getElementById(`dotp-${index + 1}`)?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      document.getElementById(`dotp-${index - 1}`)?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpDigits.join("");
    if (otp.length !== 4) {
      setOtpError("Please enter the 4-digit OTP");
      return;
    }
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
      } else {
        setOtpError(data.message || "Invalid OTP");
      }
    } catch {
      setOtpError("Something went wrong. Try again.");
    } finally {
      setOtpLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-muted">Loading order details...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-xl font-bold mb-2">Order Not Found</h2>
        <button onClick={() => router.push("/history")} className="text-primary mt-4">
          Return to History
        </button>
      </div>
    );
  }

  const currentStepIndex = STEPS.findIndex(
    (s) => s.id === order.orderStatus?.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-background flex flex-col pb-10">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-md p-4 flex items-center gap-4 border-b border-border">
        <button
          onClick={() => router.push("/history")}
          className="p-2 bg-card rounded-full border border-border"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold">Track Order</h1>
      </div>

      <div className="p-4 flex-1 max-w-md mx-auto w-full space-y-4">

        {/* Stepper */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-6">Order Status</h2>
          <div className="relative pl-6 space-y-8">
            <div className="absolute left-9 top-2 bottom-2 w-0.5 bg-border"></div>
            <div
              className="absolute left-9 top-2 w-0.5 bg-primary transition-all duration-500"
              style={{
                height: `${Math.max(0, (currentStepIndex / (STEPS.length - 1)) * 100)}%`,
              }}
            ></div>
            {STEPS.map((step, index) => {
              const isCompleted =
                index < currentStepIndex ||
                (index === STEPS.length - 1 && currentStepIndex === index);
              const isCurrent =
                index === currentStepIndex && index !== STEPS.length - 1;
              const isPending = index > currentStepIndex;
              return (
                <div key={step.id} className="relative z-10 flex items-center gap-4">
                  <div
                    className={[
                      "w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                      isCompleted ? "bg-primary border-primary text-white" : "",
                      isCurrent ? "bg-primary border-primary text-white animate-pulse" : "",
                      isPending ? "bg-background border-border text-transparent" : "",
                    ].join(" ")}
                  >
                    {(isCompleted || isCurrent) && (
                      <Check size={14} strokeWidth={3} />
                    )}
                  </div>
                  <span
                    className={[
                      "font-medium text-sm",
                      isPending ? "text-muted" : "text-foreground",
                    ].join(" ")}
                  >
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Delivery OTP Box */}
        {order.orderStatus?.toLowerCase() === "out for delivery" && !otpSuccess && (
          <div className="bg-card border-2 border-primary/30 rounded-3xl p-6 shadow-sm">
            <div className="text-center mb-4">
              <span className="text-2xl">🔐</span>
              <h2 className="text-base font-bold text-foreground mt-1">Delivery OTP</h2>
              <p className="text-xs text-muted mt-1">
                Enter the OTP sent to your phone to confirm delivery
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-4">
              {otpDigits.map((digit, i) => (
                <input
                  key={i}
                  id={`dotp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  className={[
                    "w-full aspect-square text-center text-xl font-bold rounded-xl border-2 bg-background text-foreground focus:outline-none transition-all",
                    digit ? "border-primary" : "border-border",
                  ].join(" ")}
                />
              ))}
            </div>
            {otpError && (
              <p className="text-red-500 text-xs text-center mb-3">{otpError}</p>
            )}
            <button
              onClick={handleVerifyOtp}
              disabled={otpLoading || otpDigits.join("").length !== 4}
              className="w-full bg-primary text-white font-bold py-3 rounded-2xl disabled:opacity-50 transition-all active:scale-95"
            >
              {otpLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
              ) : (
                "Confirm Delivery ✓"
              )}
            </button>
          </div>
        )}

        {/* OTP Success */}
        {otpSuccess && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-3xl p-4 text-center">
            <CheckCircle2 size={32} className="text-green-500 mx-auto mb-2" />
            <p className="font-bold text-green-500">Delivery Confirmed!</p>
            <p className="text-xs text-muted mt-1">Your order has been delivered successfully</p>
          </div>
        )}

        {/* Delivery Partner Phone */}
        {order.deliveryPartnerPhone && order.orderStatus?.toLowerCase() !== "delivered" && (
          <div className="bg-card border border-border rounded-3xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
              <Phone size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted">Delivery Partner</p>
              <p className="font-bold text-foreground">{order.deliveryPartnerPhone}</p>
            </div>

            <a
              href={`tel:${order.deliveryPartnerPhone}`}
              className="bg-primary text-white text-xs font-bold px-4 py-2 rounded-xl"
            >
              Call
            </a>
          </div>
        )}

        {/* Order Details */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
          <h2 className="text-lg font-bold mb-4 border-b border-border pb-2">Order Details</h2>
          <div className="space-y-3 mb-6">
            {order.items.map((item, i) => (
              <div key={i} className="flex justify-between items-center text-sm">
                <div className="flex items-center gap-3">
                  <span className="font-semibold px-2 py-0.5 bg-primary/10 text-primary rounded-md">
                    {item.quantity}x
                  </span>
                  <span>{item.name}</span>
                </div>
                <span className="font-semibold">₹{item.price * item.quantity}</span>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-border pt-4 text-sm text-muted">
            <div className="flex justify-between">
              <span>Item Total</span>
              <span className="text-foreground">₹{order.itemTotal}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery Fee</span>
              <span className="text-foreground">₹{order.deliveryFee}</span>
            </div>
            <div className="flex justify-between font-bold text-foreground text-lg pt-2 mt-2 border-t border-dashed border-border">
              <span>Total Amount</span>
              <span>₹{order.totalAmount}</span>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-border flex flex-col gap-1">
            <span className="text-xs text-muted uppercase tracking-wider">Payment ID</span>
            <div className="flex items-center justify-between bg-background p-3 rounded-xl border border-border">
              <span className="text-xs font-mono text-muted-foreground truncate mr-2">
                {order.paymentId}
              </span>
              <button
                onClick={() => copyToClipboard(order.paymentId)}
                className="text-primary hover:bg-primary/10 p-1.5 rounded-md transition-colors flex-shrink-0"
              >
                {copiedId ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              </button>
            </div>
          </div>
        </div>

      </div>
    </div >
  );
}