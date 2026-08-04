"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { ArrowLeft, MapPin, ShoppingBag, AlertCircle, X, Tag, Phone } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  serverTimestamp,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  setDoc,
  updateDoc,
  increment,
  arrayUnion,
} from "firebase/firestore";

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, handler: (res: Record<string, unknown>) => void) => void;
    };
  }
}

type CartItem = {
  id: string;
  name: string;
  price: number;
  offer: number;
  image: string;
  stallName: string;
  quantity: number;
  packingFee?: number;
};

// ✅ NEW: shape of the coupon data passed from cart page via localStorage
type AppliedCoupon = {
  code: string;
  id: string;
  discount: number;
};

export default function PaymentPage() {
  const router = useRouter();
  const { user, area, zone, deliveryFee, authLoading, beaches } = useUser();
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [showFailPopup, setShowFailPopup] = useState(false);
  const [failMessage, setFailMessage] = useState("");
  const [customerName, setCustomerName] = useState("Customer");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderType, setOrderType] = useState<"takeaway" | "dinein">("takeaway");
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null); // ✅ NEW
  // ✅ NEW: optional alternate contact number — so the delivery partner can reach the
  // customer if their primary number is unreachable; passed through to the order record
  const [altPhone, setAltPhone] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (document.querySelector('script[src*="razorpay"]')) {
      setRazorpayLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("bayzo_cart");
      if (saved) {
        const parsed = JSON.parse(saved) as CartItem[];
        if (parsed.length === 0) router.replace("/cart");
        else setCart(parsed);
      } else {
        router.replace("/cart");
      }
    } catch (e) {
      console.error(e);
      router.replace("/cart");
    }
    const savedOrderType = localStorage.getItem("vayra_order_type");
    if (savedOrderType === "dinein" || savedOrderType === "takeaway") {
      setOrderType(savedOrderType);
    }
    // ✅ NEW: read applied coupon (set by cart page before navigating here)
    try {
      const savedCoupon = localStorage.getItem("vayra_applied_coupon");
      if (savedCoupon) {
        setAppliedCoupon(JSON.parse(savedCoupon));
      }
    } catch (e) {
      console.error("Coupon parse error:", e);
    }
  }, [mounted, router]);

  useEffect(() => {
    if (!mounted) return;
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const localUser = JSON.parse(userStr);
        if (localUser.phoneNumber) {
          setCustomerPhone(String(localUser.phoneNumber).replace("+91", ""));
        }
        if (localUser.name) {
          setCustomerName(localUser.name);
        }
      }
    } catch (e) {
      console.error("localStorage user parse error:", e);
    }
  }, [mounted]);

  useEffect(() => {
    const fetchCustomerDetails = async () => {
      if (!user?.uid) return;
      try {
        let userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          const withPrefix = user.uid.startsWith("91") ? user.uid : `91${user.uid}`;
          userDoc = await getDoc(doc(db, "users", withPrefix));
        }
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.name) setCustomerName(data.name);
          const rawPhone =
            data.displayPhone ||
            data.phone?.replace(/^91/, "") ||
            user.uid.replace(/^91/, "") ||
            "";
          if (rawPhone) setCustomerPhone(rawPhone);
        }
      } catch (e) {
        console.error("Error fetching customer details:", e);
      }
    };
    fetchCustomerDetails();
  }, [user]);

  const finalPrice = (item: CartItem) => {
    if (item.offer > 0) return Math.round(item.price - (item.price * item.offer) / 100);
    return item.price;
  };

  const subtotal = cart.reduce((sum, i) => sum + finalPrice(i) * i.quantity, 0);
  const totalPackingFee = cart.reduce((sum, i) => sum + (i.packingFee || 0) * i.quantity, 0);
  // ✅ NEW: coupon discount subtracted from subtotal before adding delivery/packing fees
  const couponDiscountAmount = appliedCoupon ? Math.round((subtotal * appliedCoupon.discount) / 100) : 0;
  const total = orderType === "dinein"
    ? subtotal - couponDiscountAmount
    : subtotal + deliveryFee + totalPackingFee - couponDiscountAmount;
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const getVendorId = async (stallName: string): Promise<string> => {
    try {
      const q = query(collection(db, "vendors"), where("stallName", "==", stallName));
      const snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0].id;
    } catch (e) {
      console.error("vendorId lookup failed:", e);
    }
    return "";
  };

  const handlePayment = async () => {
    if (!razorpayLoaded || isProcessing) return;
    if (!user) {
      setFailMessage("You're not logged in. Please login and try again.");
      setShowFailPopup(true);
      return;
    }
    setIsProcessing(true);

    try {
      const vendorName = cart.length > 0 ? cart[0].stallName : "Unknown Vendor";
      const itemsSummary = cart.map((i) => `${i.quantity}x ${i.name}`).join(", ");
      const vendorId = await getVendorId(vendorName);
      const normalizedUserId = user?.phoneNumber?.replace("+91", "91") || user?.uid || "guest";

      let beachId = "";
      let zoneId = "";
      if (area) {
        const matchedBeach = beaches.find((b) => b.area === area || b.name === area);
        if (matchedBeach) {
          beachId = matchedBeach.id;
          if (zone !== null && matchedBeach.zones?.[zone - 1]) {
            zoneId = matchedBeach.zones[zone - 1].name || `Zone ${zone}`;
          }
        }
      }

      const docRef = doc(collection(db, "orders"));
      const orderId = docRef.id;

      // ✅ Order-ஐ Razorpay checkout open ஆகுறதுக்கு முன்னாடியே Firestore-ல create பண்றோம்
      // (paymentStatus: "created"). இப்படி பண்றதால், webhook (server-side, Razorpay-இருந்து நேரடியா
      // வரும்) இந்த doc-ஐ கண்டுபிடிச்சு "paid" ஆக update பண்ண முடியும் — user browser-க்கு
      // திரும்ப காத்திருக்க வேண்டாம்.
      const orderPayload = {
        orderId,
        customerId: user?.uid || normalizedUserId,
        customerName,
        customerPhone,
        alternatePhone: altPhone || null, // ✅ NEW: optional alternate contact, shown to delivery partner
        vendorName,
        vendorId,
        itemsSummary,
        phone: user?.phoneNumber || customerPhone || "unknown",
        location: { area, zone: zone !== null ? `Zone ${zone}` : "" },
        items: cart.map((i) => ({
          foodId: i.id, // rating system-ku venum — food-level rating attach panna idhu mandatory
          name: i.name,
          price: finalPrice(i),
          quantity: i.quantity,
          stallName: i.stallName,
        })),
        itemTotal: subtotal,
        deliveryFee: orderType === "dinein" ? 0 : deliveryFee,
        packingFee: orderType === "dinein" ? 0 : totalPackingFee,
        couponCode: appliedCoupon?.code || null,        // ✅ NEW: record which coupon was used
        couponDiscountPercent: appliedCoupon?.discount || 0, // ✅ NEW
        couponDiscountAmount: couponDiscountAmount,      // ✅ NEW: rupee amount saved
        totalAmount: total,
        orderType,
        paymentMethod: "razorpay",
        paymentStatus: "created", // webhook/handler இது "paid"-ஆ மாத்தும்
        status: "pending",         // "placed" ஆவது payment success ஆனா தான்
        orderStatus: "pending",
        createdAt: serverTimestamp(),
        beachId,
        zoneId,
        userId: normalizedUserId,
      };

      try {
        await setDoc(docRef, orderPayload);
      } catch (err) {
        console.error("Pre-payment order create failed:", err);
        setIsProcessing(false);
        setFailMessage("Could not initiate order. Please try again.");
        setShowFailPopup(true);
        return;
      }

      const options: Record<string, unknown> = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: total * 100,
        currency: "INR",
        name: "Vayra",
        description: "Beach Food Delivery - Vayra",
        // firestoreOrderId-ஐ Razorpay "notes"-ல அனுப்றோம் — webhook இதை வெச்சு
        // exact document-ஐ direct-ஆ கண்டுபிடிக்கும், query தேவையில்ல
        notes: { firestoreOrderId: orderId },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
        }) {
          // இப்போ setDoc இல்ல, updateDoc (merge) — doc already create ஆகி இருக்கு
          let saveSuccess = false;
          let lastError = null;
          for (let attempt = 1; attempt <= 3; attempt++) {
            try {
              await setDoc(docRef, {
                paymentStatus: "paid",
                status: "placed",
                orderStatus: "placed",
                razorpayOrderId: response.razorpay_order_id || "",
                razorpayPaymentId: response.razorpay_payment_id || "",
              }, { merge: true });
              saveSuccess = true;
              break;
            } catch (err) {
              lastError = err;
              console.error(`Firestore update attempt ${attempt} failed:`, err);
              if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
            }
          }

          if (!saveSuccess) {
            console.error("All 3 Firestore update attempts failed:", lastError);
          }

          // ✅ NEW: record coupon usage — increment usageCount + add user to usedBy list
          // (so one-time-per-user and usage-limit checks work on future orders)
          if (appliedCoupon?.id) {
            try {
              const userIdentifier = user?.uid || user?.phoneNumber || normalizedUserId;
              await updateDoc(doc(db, "coupons", appliedCoupon.id), {
                usageCount: increment(1),
                usedBy: arrayUnion(userIdentifier),
              });
            } catch (e) {
              console.error("Failed to record coupon usage:", e);
              // non-blocking — order already placed successfully, this is just tracking
            }
          }

          try {
            localStorage.removeItem("bayzo_cart");
            localStorage.removeItem("vayra_applied_coupon"); // ✅ NEW: clear coupon after use
          } catch (e) { console.error(e); }
          window.location.href = `/confirmed?orderId=${orderId}&amount=${total}&paymentId=${response.razorpay_payment_id}&rzpOrderId=${response.razorpay_order_id}`;
        },
        prefill: {
          contact: customerPhone || user?.phoneNumber?.replace("+91", "") || "",
        },
        theme: { color: "#FF6B00" },
        modal: {
          ondismiss: function () { setIsProcessing(false); },
        },
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (response: Record<string, unknown>) => {
          const error = response.error as { code?: string; description?: string } | undefined;
          setIsProcessing(false);
          setFailMessage(error?.description || "Payment failed. Please try again.");
          setShowFailPopup(true);
        });
        rzp.open();
      } catch {
        setIsProcessing(false);
        setFailMessage("Could not open payment. Please try again.");
        setShowFailPopup(true);
      }
    } catch (e) {
      console.error("Payment initiation error:", e);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Fail Popup */}
      {showFailPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm border border-gray-200 shadow-2xl">
            <div className="flex justify-end mb-2">
              <button onClick={() => setShowFailPopup(false)} className="text-gray-400 hover:text-black">
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <AlertCircle size={36} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-black">Payment Failed</h2>
              <p className="text-sm text-gray-500">{failMessage}</p>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => { setShowFailPopup(false); router.push("/home"); }}
                  className="flex-1 py-3 rounded-2xl border border-gray-200 text-black font-semibold text-sm"
                >
                  Go Home
                </button>
                <button
                  onClick={() => { setShowFailPopup(false); handlePayment(); }}
                  className="flex-1 py-3 rounded-2xl bg-primary text-white font-bold text-sm"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-4 border-b border-gray-100">
        <button
          onClick={() => router.back()}
          disabled={isProcessing}
          className="p-2 bg-gray-50 rounded-full border border-gray-200 disabled:opacity-50"
        >
          <ArrowLeft size={20} className="text-black" />
        </button>
        <h1 className="text-xl font-bold text-black">Checkout</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">

        {/* Location */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
            <MapPin size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Delivering to</p>
            <p className="font-bold text-black">{area} — Zone {zone}</p>
          </div>
        </div>

        {/* ✅ NEW: Alternate Contact Number */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-bold text-black mb-2 flex items-center gap-2">
            <Phone size={16} className="text-primary" /> Alternate Contact Number
          </h3>
          <input
            type="tel"
            value={altPhone}
            onChange={(e) => setAltPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="Alternate phone number (optional)"
            maxLength={10}
            className="w-full bg-white text-black rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <p className="text-xs text-gray-400 mt-2">So the delivery partner can reach you if needed</p>
        </div>

        {/* Order Items */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <h3 className="font-bold text-black mb-3 flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary" />
            Order Items ({totalItems})
          </h3>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-black text-sm line-clamp-1">{item.name}</p>
                  <p className="text-xs text-gray-500">🏪 {item.stallName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-black text-sm">₹{finalPrice(item) * item.quantity}</p>
                  <p className="text-xs text-gray-500">x{item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bill Summary */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-3">
          <h3 className="font-bold text-black border-b border-gray-100 pb-2">Bill Summary</h3>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Item Total</span>
            <span className="font-semibold text-black">₹{subtotal}</span>
          </div>
          {orderType === "takeaway" && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Delivery Fee (Zone {zone})</span>
              <span className="font-semibold text-black">₹{deliveryFee}</span>
            </div>
          )}
          {orderType === "takeaway" && totalPackingFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">📦 Packing Fee</span>
              <span className="font-semibold text-black">₹{totalPackingFee}</span>
            </div>
          )}
          {/* ✅ NEW: coupon discount line — only shows if a coupon was applied on cart page */}
          {appliedCoupon && couponDiscountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-600 flex items-center gap-1">
                <Tag size={13} /> Coupon ({appliedCoupon.code})
              </span>
              <span className="font-semibold text-green-600">- ₹{couponDiscountAmount}</span>
            </div>
          )}
          <div className="border-t border-gray-100 pt-3 flex justify-between">
            <span className="font-bold text-black text-base">Total to Pay</span>
            <span className="font-black text-black text-xl">₹{total}</span>
          </div>
        </div>

      </div>

      {/* Fixed bottom button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 border-t border-gray-100 bg-white">
        <button
          onClick={handlePayment}
          disabled={!razorpayLoaded || isProcessing || cart.length === 0 || authLoading}
          className="w-full bg-[#00C853] text-white font-bold py-4 rounded-2xl flex items-center justify-between px-6 shadow-lg active:scale-95 transition-all disabled:opacity-70"
        >
          <span className="text-base font-bold">₹{total}</span>
          <span className="text-lg font-bold">
            {isProcessing ? "Processing..." : authLoading ? "Loading..." : "Pay Now →"}
          </span>
        </button>
        <p className="text-center text-xs text-gray-500 mt-3">🔒 Secured by Razorpay</p>
      </div>

    </div>
  );
}