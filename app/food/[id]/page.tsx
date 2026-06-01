"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Plus, Minus } from "lucide-react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useUser } from "@/context/UserContext";

type FoodItem = {
  id: string;
  name: string;
  price: number;
  offer: number;
  image: string;
  stallName: string;
  foodType?: string;
  rating?: number;
  description?: string;
};

type CartItem = FoodItem & { quantity: number };

export default function FoodDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { area, zone } = useUser();
  const [mounted, setMounted] = useState(false);
  const [food, setFood] = useState<FoodItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Firebase-லிருந்து food fetch பண்றோம்
  useEffect(() => {
    const fetchFood = async () => {
      try {
        const docRef = doc(db, "foods", params.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setFood({ id: docSnap.id, ...docSnap.data() } as FoodItem);
        } else {
          router.replace("/home");
        }
      } catch (e) {
        console.error("Food fetch error:", e);
        router.replace("/home");
      } finally {
        setLoading(false);
      }
    };
    fetchFood();
  }, [params.id]);

  // Cart-லிருந்து current quantity எடுக்கறோம்
  useEffect(() => {
    if (!mounted || !food) return;
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("bayzo_cart");
      if (saved) {
        const cart: CartItem[] = JSON.parse(saved);
        const existing = cart.find((i) => i.id === food.id);
        setQuantity(existing?.quantity || 0);
      }
    } catch (e) {
      console.error(e);
      setQuantity(0);
    }
  }, [food, mounted]);

  const updateCart = (newQty: number) => {
    if (!mounted || !food) return;
    if (typeof window === "undefined") return;
    let saved = null;
    try {
      saved = localStorage.getItem("bayzo_cart");
    } catch (e) {
      console.error(e);
    }
    let cart: CartItem[] = [];
    try {
      cart = saved ? JSON.parse(saved) : [];
    } catch {
      cart = [];
    }

    const idx = cart.findIndex((i) => i.id === food.id);

    if (newQty <= 0) {
      // Remove from cart
      cart = cart.filter((i) => i.id !== food.id);
    } else if (idx >= 0) {
      // Update quantity
      cart[idx].quantity = newQty;
    } else {
      // ✅ FIX: stallName உள்பட எல்லாம் save பண்றோம்
      cart.push({
        id: food.id,
        name: food.name,
        price: food.price,
        offer: food.offer || 0,
        image: food.image || "",
        stallName: food.stallName || "",
        foodType: food.foodType || "veg",
        quantity: newQty,
      });
    }

    try {
      localStorage.setItem("bayzo_cart", JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
    setQuantity(newQty);
  };

  const finalPrice = food
    ? food.offer > 0
      ? Math.round(food.price - (food.price * food.offer) / 100)
      : food.price
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!food) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24 relative">
      {/* Top Image */}
      <div className="relative h-72 w-full bg-card">
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white"
        >
          <ArrowLeft size={20} />
        </button>

        {food.image ? (
          <img
            src={food.image}
            alt={food.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-4xl bg-card">
            🍔
          </div>
        )}

        {food.offer > 0 && (
          <div className="absolute bottom-4 left-4 bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg">
            {food.offer}% OFF
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-6 flex-1 bg-background -mt-6 rounded-t-3xl relative z-10">
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 pr-2">
            {/* Veg/NonVeg indicator */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-4 h-4 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${food.foodType === "nonveg" ? "border-red-500" : "border-green-500"
                  }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${food.foodType === "nonveg" ? "bg-red-500" : "bg-green-500"
                    }`}
                />
              </span>
              <span className="text-xs text-muted capitalize">{food.foodType || "veg"}</span>
            </div>
            <h1 className="text-2xl font-bold text-foreground">{food.name}</h1>
            {food.stallName && (
              <p className="text-sm text-muted mt-1">🏪 {food.stallName}</p>
            )}
          </div>
          {food.rating && (
            <div className="flex items-center gap-1 bg-card px-2 py-1 rounded-lg border border-border flex-shrink-0">
              <Star size={14} className="text-yellow-500 fill-yellow-500" />
              <span className="font-bold text-sm">{food.rating}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 mt-3 mb-6">
          <span className="text-2xl font-bold text-primary">₹{finalPrice}</span>
          {food.offer > 0 && (
            <span className="line-through text-muted text-base">₹{food.price}</span>
          )}
        </div>

        <h3 className="font-bold text-lg mb-2">Description</h3>
        <p className="text-muted leading-relaxed text-sm">
          {food.description ||
            `Delicious ${food.name.toLowerCase()} prepared fresh for you. Perfect to enjoy while relaxing at the beach.`}
        </p>

        {/* Location info */}
        {area && zone && (
          <div className="mt-4 bg-card rounded-xl border border-border p-3 flex items-center gap-2">
            <span className="text-lg">📍</span>
            <div>
              <p className="text-xs text-muted">Delivering to</p>
              <p className="text-sm font-semibold text-foreground">{area} — Zone {zone}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Action */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t border-border z-50">
        {quantity === 0 ? (
          <button
            onClick={() => updateCart(1)}
            className="w-full bg-primary text-white font-bold py-4 rounded-2xl text-lg shadow-lg active:scale-[0.98] transition-transform"
          >
            Add to Cart
          </button>
        ) : (
          <div className="flex items-center gap-4">
            <div className="flex-1 flex items-center bg-card rounded-2xl border border-primary h-14 overflow-hidden">
              <button
                onClick={() => updateCart(quantity - 1)}
                className="w-14 h-full flex items-center justify-center text-primary active:bg-primary/10"
              >
                <Minus size={24} />
              </button>
              <div className="flex-1 text-center font-bold text-xl">{quantity}</div>
              <button
                onClick={() => updateCart(quantity + 1)}
                className="w-14 h-full flex items-center justify-center text-primary active:bg-primary/10"
              >
                <Plus size={24} />
              </button>
            </div>
            <button
              onClick={() => router.push("/cart")}
              className="flex-1 bg-primary text-white font-bold h-14 rounded-2xl flex items-center justify-center shadow-lg active:scale-[0.98] transition-transform"
            >
              Go to Cart →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}