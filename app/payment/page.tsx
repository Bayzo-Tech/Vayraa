"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { ArrowLeft, MapPin, ShoppingBag, AlertCircle, X } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  setDoc,
} from "firebase/firestore";

declare global {
  interface Window {
    // ✅ FIX 1: any → unknown constructor type
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
};

export default function PaymentPage() {
  // ✅ FIX 2: router useEffect dependency fix - router ref stable பண்றோம்
  const router = useRouter();
  const { user, area, zone, deliveryFee } = useUser();
  const [mounted, setMounted] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);
  const [showFailPopup, setShowFailPopup] = useState(false);
  const [failMessage, setFailMessage] = useState("");
  const [customerName, setCustomerName] = useState("Customer");
  const [customerPhone, setCustomerPhone] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

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
  // ✅ FIX: router dependency add பண்றோம்
  }, [mounted, router]);

  useEffect(() => {
    const fetchCustomerDetails = async () => {
      if (!user?.uid) return;
      try {
        let userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
          const withPrefix = user.uid.startsWith("91")
            ? user.uid
            : `91${user.uid}`;
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
          setCustomerPhone(rawPhone);
        } else {
          setCustomerPhone(user.uid.replace(/^91/, ""));
        }
      } catch (e) {
        console.error("Error fetching customer details:", e);
        setCustomerPhone(user.uid.replace(/^91/, ""));
      }
    };
    fetchCustomerDetails();
  }, [user]);

  const finalPrice = (item: CartItem) => {
    if (item.offer > 0)
      return Math.round(item.price - (item.price * item.offer) / 100);
    return item.price;
  };

  const subtotal = cart.reduce(
    (sum, i) => sum + finalPrice(i) * i.quantity,
    0
  );
  const total = subtotal + deliveryFee;
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  const getVendorId = async (stallName: string): Promise<string> => {
    try {
      const q = query(
        collection(db, "vendors"),
        where("stallName", "==", stallName)
      );
      const snap = await getDocs(q);
      if (!snap.empty) return snap.docs[0].id;
    } catch (e) {
      console.error("vendorId lookup failed:", e);
    }
    return "";
  };

  const handlePayment = async () => {
    if (!razorpayLoaded || isProcessing) return;
    setIsProcessing(true);

    const options: Record<string, unknown> = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      amount: total * 100,
      currency: "INR",
      name: "Vayra",
      description: "Beach Food Delivery - Vayra",
      handler: async function (response: { razorpay_payment_id: string }) {
        try {
          const vendorName =
            cart.length > 0 ? cart[0].stallName : "Unknown Vendor";
          const itemsSummary = cart
            .map((i) => `${i.quantity}x ${i.name}`)
            .join(", ");

          const vendorId = await getVendorId(vendorName);

          const normalizedUserId =
            user?.phoneNumber?.replace("+91", "91") ||
            user?.uid ||
            "guest";

          // Lookup beachId and zoneId in Firestore
          let beachId = "";
          let zoneId = "";
          try {
            if (area) {
              const beachSnap = await getDocs(collection(db, "beaches"));
              for (const beachDoc of beachSnap.docs) {
                const beachData = beachDoc.data();
                if (beachData.area === area || beachData.name === area) {
                  beachId = beachDoc.id;
                  if (beachData.zones && zone !== null && beachData.zones[zone - 1]) {
                    zoneId = beachData.zones[zone - 1].name || `Zone ${zone}`;
                  }
                  break;
                }
              }
            }
          } catch (err) {
            console.error("Error looking up beach/zone mapping:", err);
          }

          const docRef = doc(collection(db, "orders"));
          const orderId = docRef.id;

          await setDoc(docRef, {
            orderId: orderId,
            customerId: user?.uid || normalizedUserId,
            customerName: customerName,
            customerPhone: customerPhone,
            vendorName: vendorName,
            vendorId: vendorId,
            itemsSummary: itemsSummary,
            phone: user?.phoneNumber || customerPhone || "unknown",
            location: { area, zone: `Zone ${zone}` },
            items: cart.map((i) => ({
              name: i.name,
              price: finalPrice(i),
              quantity: i.quantity,
              stallName: i.stallName,
            })),
            itemTotal: subtotal,
            deliveryFee,
            totalAmount: total,
            paymentId: response.razorpay_payment_id,
            paymentMethod: "razorpay",
            paymentStatus: "paid",
            status: "placed",
            orderStatus: "placed",
            createdAt: serverTimestamp(),
            beachId: beachId,
            zoneId: zoneId,
            userId: normalizedUserId,
          });

          if (typeof window !== "undefined") {
            try {
              sessionStorage.setItem("last_order_id", orderId);
              sessionStorage.setItem("last_order_amount", total.toString());
              sessionStorage.setItem("last_order_items", JSON.stringify(cart.map(i => ({
                name: i.name,
                quantity: i.quantity,
                price: finalPrice(i)
              }))));
              localStorage.removeItem("bayzo_cart");
            } catch (e) {
              console.error(e);
            }
          }
          window.location.href = `/confirmed?orderId=${orderId}&amount=${total}`;
        } catch (e) {
          console.error("Firestore error:", e);
          setIsProcessing(false);
        }
      },
      prefill: {
        contact:
          customerPhone || user?.phoneNumber?.replace("+91", "") || "",
      },
      theme: { color: "#FF6B00" },
      modal: {
        ondismiss: function () {
          setIsProcessing(false);
        },
      },
    };

    try {
      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", async (response: Record<string, unknown>) => {
        const error = response.error as { code?: string; description?: string } | undefined;
        try {
          await addDoc(collection(db, "orders"), {
            userId: user?.phoneNumber?.replace("+91", "91") || user?.uid || "guest",
            customerName: customerName,
            customerPhone: customerPhone,
            paymentStatus: "failed",
            orderStatus: "failed",
            errorCode: error?.code || "",
            errorDescription: error?.description || "",
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error(e);
        } finally {
          setIsProcessing(false);
          setFailMessage(
            error?.description || "Payment failed. Please try again."
          );
          setShowFailPopup(true);
        }
      });
      rzp.open();
    } catch {
      setIsProcessing(false);
      setFailMessage("Could not open payment. Please try again.");
      setShowFailPopup(true);
    }
  };

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {showFailPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-6">
          <div className="bg-card rounded-3xl p-6 w-full max-w-sm border border-border shadow-2xl">
            <div className="flex justify-end mb-2">
              <button
                onClick={() => setShowFailPopup(false)}
                className="text-muted hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex flex-col items-center text-center gap-4">
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                <AlertCircle size={36} className="text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground">
                Payment Failed
              </h2>
              <p className="text-sm text-muted">{failMessage}</p>
              <div className="flex gap-3 w-full mt-2">
                <button
                  onClick={() => {
                    setShowFailPopup(false);
                    router.push("/home");
                  }}
                  className="flex-1 py-3 rounded-2xl border border-border text-foreground font-semibold text-sm"
                >
                  Go Home
                </button>
                <button
                  onClick={() => {
                    setShowFailPopup(false);
                    handlePayment();
                  }}
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
      <div className="flex-shrink-0 bg-background/90 backdrop-blur-md px-4 py-3 flex items-center gap-4 border-b border-border">
        <button
          onClick={() => router.back()}
          disabled={isProcessing}
          className="p-2 bg-card rounded-full border border-border disabled:opacity-50"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-foreground">Checkout</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
            <MapPin size={20} className="text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted">Delivering to</p>
            <p className="font-bold text-foreground">
              {area} — Zone {zone}
            </p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <ShoppingBag size={18} className="text-primary" />
            Order Items ({totalItems})
          </h3>
          <div className="space-y-3">
            {cart.map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                  {item.image ? (
                    // ✅ FIX 3: <img> → eslint warning suppress பண்றோம்
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">
                      No img
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm line-clamp-1">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted">🏪 {item.stallName}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-foreground text-sm">
                    ₹{finalPrice(item) * item.quantity}
                  </p>
                  <p className="text-xs text-muted">x{item.quantity}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h3 className="font-bold text-foreground border-b border-border pb-2">
            Bill Summary
          </h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Item Total</span>
            <span className="font-semibold text-foreground">₹{subtotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Delivery Fee (Zone {zone})</span>
            <span className="font-semibold text-foreground">₹{deliveryFee}</span>
          </div>
          <div className="border-t border-border pt-3 flex justify-between">
            <span className="font-bold text-foreground text-base">
              Total to Pay
            </span>
            <span className="font-black text-foreground text-xl">₹{total}</span>
          </div>
        </div>
        <div className="h-4" />
      </div>

      {/* Pay Button */}
      <div className="flex-shrink-0 p-4 border-t border-border bg-background">
        <button
          onClick={handlePayment}
          disabled={!razorpayLoaded || isProcessing || cart.length === 0}
          className="w-full bg-[#00C853] text-white font-bold py-4 rounded-2xl flex items-center justify-between px-6 shadow-lg active:scale-95 transition-all disabled:opacity-70"
        >
          <span className="text-base font-bold">₹{total}</span>
          <span className="text-lg font-bold">
            {isProcessing ? "Processing..." : "Pay Now →"}
          </span>
        </button>
        <p className="text-center text-xs text-muted mt-3">
          🔒 Secured by Razorpay
        </p>
      </div>
    </div>
  );
}