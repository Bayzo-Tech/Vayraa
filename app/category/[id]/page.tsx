"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Minus, Trash2, ShoppingBag, Tag, X } from "lucide-react";
import Image from "next/image";
import { useUser } from "@/context/UserContext";

type CartItem = {
  id: string;
  name: string;
  price: number;
  offer: number;
  image: string;
  stallName: string;
  foodType?: string;
  quantity: number;
  packingFee?: number;
};

const VALID_COUPONS: Record<string, number> = {
  BEACH10: 10,
  WAVE20: 20,
  FIRSTORDER: 15,
};

export default function CartPage() {
  const router = useRouter();
  const { zone, deliveryFee } = useUser();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState("");
  const [orderType, setOrderType] = useState<"takeaway" | "dinein">("takeaway");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem("bayzo_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch { setCart([]); }
    const savedOrderType = localStorage.getItem("vayra_order_type");
    if (savedOrderType === "dinein" || savedOrderType === "takeaway") setOrderType(savedOrderType);
    setIsLoaded(true);
  }, [mounted]);

  useEffect(() => {
    if (mounted && isLoaded) {
      try { localStorage.setItem("bayzo_cart", JSON.stringify(cart)); } catch { }
    }
  }, [cart, mounted, isLoaded]);

  useEffect(() => {
    if (!mounted) return;
    try { localStorage.setItem("vayra_order_type", orderType); } catch { }
  }, [orderType, mounted]);

  const updateQty = (id: string, delta: number) => {
    setCart((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;
      if (item.quantity + delta <= 0) return prev.filter((i) => i.id !== id);
      return prev.map((i) => i.id === id ? { ...i, quantity: i.quantity + delta } : i);
    });
  };

  const finalPrice = (item: CartItem) => {
    if (item.offer > 0) return Math.round(item.price - (item.price * item.offer) / 100);
    return item.price;
  };

  const applyCoupon = () => {
    const code = couponCode.trim().toUpperCase();
    if (!code) return;
    if (VALID_COUPONS[code]) {
      setAppliedCoupon(code);
      setCouponDiscount(VALID_COUPONS[code]);
      setCouponError("");
    } else {
      setCouponError("Invalid coupon code");
      setAppliedCoupon(null);
      setCouponDiscount(0);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponDiscount(0);
    setCouponCode("");
    setCouponError("");
  };

  const subtotal = cart.reduce((sum, i) => sum + finalPrice(i) * i.quantity, 0);
  const totalPackingFee = cart.reduce((sum, i) => sum + (i.packingFee || 0) * i.quantity, 0);
  const discountAmount = appliedCoupon ? Math.round((subtotal * couponDiscount) / 100) : 0;
  const total = orderType === "dinein"
    ? subtotal - discountAmount
    : subtotal + deliveryFee + totalPackingFee - discountAmount;
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  // ✅ FIXED: Check session properly
  const handleProceedToPay = () => {
    try {
      const userStr = localStorage.getItem("user");
      const localUser = userStr ? JSON.parse(userStr) : null;

      // No user at all → login with redirect
      if (!localUser || !localUser.uid) {
        router.push("/login?redirect=/payment");
        return;
      }

      // User exists but profile incomplete → basic details
      if (!localUser.profileComplete) {
        router.push("/basic-details?redirect=/payment");
        return;
      }

      // All good → payment
      router.push("/payment");
    } catch {
      router.push("/login?redirect=/payment");
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
        <div className="w-24 h-24 bg-card rounded-full flex items-center justify-center mb-6 border border-border">
          <ShoppingBag size={40} className="text-muted" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-foreground">Your cart is empty</h2>
        <p className="text-muted mb-8 text-center text-sm">Add some delicious beach food!</p>
        <button
          onClick={() => router.push("/home")}
          className="bg-primary text-white font-bold py-3 px-8 rounded-xl shadow-lg active:scale-95 transition-all"
        >
          Browse Food
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md px-4 py-3 flex items-center gap-4 border-b border-border">
        <button onClick={() => router.back()} className="p-2 bg-card rounded-full border border-border">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-foreground">Your Cart</h1>
          <p className="text-xs text-muted">{totalItems} item{totalItems > 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">

        {/* Cart Items */}
        <div className="space-y-3">
          {cart.map((item) => {
            const price = finalPrice(item);
            return (
              <div key={item.id} className="bg-card rounded-2xl border border-border p-3 flex gap-3">
                <div className="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 relative">
                  {item.image ? (
                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-300">No Image</div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between min-w-0">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className={`w-3.5 h-3.5 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${item.foodType === "nonveg" ? "border-red-500" : "border-green-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${item.foodType === "nonveg" ? "bg-red-500" : "bg-green-500"}`}></span>
                      </span>
                      <h3 className="font-bold text-foreground text-sm line-clamp-1">{item.name}</h3>
                    </div>
                    {item.stallName && <p className="text-xs text-muted mb-1">🏪 {item.stallName}</p>}
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-foreground text-sm">₹{price}</span>
                      {item.offer > 0 && <span className="line-through text-xs text-muted">₹{item.price}</span>}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center bg-primary rounded-xl overflow-hidden">
                      <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-white active:scale-90 transition-transform">
                        {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-white">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-white active:scale-90 transition-transform">
                        <Plus size={13} />
                      </button>
                    </div>
                    <span className="font-bold text-foreground text-sm">₹{price * item.quantity}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Coupon Section */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="font-bold text-foreground mb-3 flex items-center gap-2">
            <Tag size={16} className="text-primary" /> Apply Coupon
          </h3>
          {appliedCoupon ? (
            <div className="flex items-center justify-between bg-green-500/10 border border-green-500/30 rounded-xl px-4 py-3">
              <div>
                <p className="text-green-500 font-bold text-sm">{appliedCoupon}</p>
                <p className="text-green-400 text-xs">{couponDiscount}% off applied!</p>
              </div>
              <button onClick={removeCoupon} className="text-muted hover:text-foreground transition-colors">
                <X size={18} />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => { setCouponCode(e.target.value); setCouponError(""); }}
                placeholder="ENTER COUPON CODE"
                className="flex-1 bg-background text-foreground rounded-xl border border-border px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary uppercase"
              />
              <button onClick={applyCoupon} className="bg-primary text-white font-bold px-4 py-2.5 rounded-xl text-sm active:scale-95 transition-transform">
                Apply
              </button>
            </div>
          )}
          {couponError && <p className="text-red-500 text-xs mt-2">{couponError}</p>}
          {!appliedCoupon && <p className="text-muted text-xs mt-2">Try: BEACH10, WAVE20, FIRSTORDER</p>}
        </div>

        {/* Order Type Toggle */}
        <div className="bg-card rounded-2xl border border-border p-4">
          <h3 className="font-bold text-foreground mb-3">Order Type</h3>
          <div className="flex gap-2">
            <button
              onClick={() => setOrderType("takeaway")}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${orderType === "takeaway" ? "bg-primary text-white" : "bg-card border border-border text-muted"}`}
            >
              🥡 Takeaway
            </button>
            <button
              onClick={() => setOrderType("dinein")}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${orderType === "dinein" ? "bg-primary text-white" : "bg-card border border-border text-muted"}`}
            >
              🍽️ Dine-in
            </button>
          </div>
        </div>

        {/* Bill Details */}
        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <h3 className="font-bold text-foreground border-b border-border pb-2">Bill Details</h3>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Item Total</span>
            <span className="font-semibold text-foreground">₹{subtotal}</span>
          </div>
          {orderType === "takeaway" && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">Delivery Fee {zone ? `(Zone ${zone})` : ""}</span>
              <span className="font-semibold text-foreground">₹{deliveryFee}</span>
            </div>
          )}
          {orderType === "takeaway" && totalPackingFee > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted">📦 Packing Fee</span>
              <span className="font-semibold text-foreground">₹{totalPackingFee}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-green-500">Coupon Discount ({couponDiscount}%)</span>
              <span className="font-semibold text-green-500">- ₹{discountAmount}</span>
            </div>
          )}
          <div className="border-t border-border pt-3 flex justify-between font-bold text-lg">
            <span className="text-foreground">To Pay</span>
            <span className="text-foreground">₹{total}</span>
          </div>
        </div>

      </div>

      {/* ✅ FIXED: Proceed to Pay button */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border">
        <button
          onClick={handleProceedToPay}
          className="w-full bg-primary text-white font-bold py-4 rounded-2xl flex items-center justify-between px-5 shadow-lg active:scale-95 transition-all"
        >
          <span className="text-sm font-semibold">₹{total} total</span>
          <span className="font-bold text-base">Proceed to Pay →</span>
        </button>
      </div>

    </div>
  );
}