"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ShoppingCart, Plus, Minus, Search } from "lucide-react";
import { db } from "@/lib/firebase";
import {
  collection, query, where, getDocs,
  onSnapshot
} from "firebase/firestore";

interface Food {
  id: string;
  name: string;
  price: number;
  offer?: number;
  image?: string;
  description?: string;
  foodType?: string;
  stallName?: string;
  packingFee?: number;
  rating?: number;
  categoryId?: string;
  available?: boolean;
}

interface CartItem extends Food {
  quantity: number;
}

// ✅ NEW: Cloudinary URL-ல f_auto,q_auto transform inject பண்ணி
// auto WebP/AVIF format + auto quality serve பண்ண வைக்குறோம்.
// Cloudinary URL இல்லாத images (or already transformed ones) தொடமாட்டோம்.
const optimizeCloudinaryUrl = (url?: string): string => {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("f_auto") || url.includes("q_auto")) return url;
  return url.replace("/upload/", "/upload/f_auto,q_auto/");
};

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const categoryId = params?.id as string;

  const [foods, setFoods] = useState<Food[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryName, setCategoryName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "veg" | "nonveg">("all");
  const [vendorOpenMap, setVendorOpenMap] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ✅ Load cart from localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem("bayzo_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch { }
  }, [mounted]);

  // ✅ Save cart to localStorage
  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("bayzo_cart", JSON.stringify(cart));
    } catch { }
  }, [cart, mounted]);

  // ✅ Fetch category name
  useEffect(() => {
    if (!categoryId) return;
    const fetchCategory = async () => {
      try {
        const docSnap = await getDocs(
          query(collection(db, "categories"), where("__name__", "==", categoryId))
        );
        if (!docSnap.empty) {
          setCategoryName(docSnap.docs[0].data().name || "");
        }
      } catch { }
    };
    fetchCategory();
  }, [categoryId]);

  // ✅ Fetch foods by category
  useEffect(() => {
    if (!categoryId) return;
    setLoading(true);
    const fetchFoods = async () => {
      try {
        const q = query(
          collection(db, "foods"),
          where("categoryId", "==", categoryId)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Food));
        setFoods(list);
      } catch { }
      finally { setLoading(false); }
    };
    fetchFoods();
  }, [categoryId]);

  // ✅ CHANGED: N separate onSnapshot listeners (one per stall) → ஒரே single
  // onSnapshot listener using where("stallName","in",[...]). Firestore "in"
  // query max 30 values ஏத்துக்கும் — உங்க category-க்கு stall count அதுக்குள்ள
  // இருக்கும்னு assume பண்றோம் (typical case). Listener count இப்போ vendor
  // count-ஐ சாராது, category-க்கு எப்போதும் 1 listener மட்டும்.
  const setupVendorListeners = useCallback(() => {
    if (foods.length === 0) return;
    const uniqueStallNames = Array.from(new Set(foods.map(f => f.stallName).filter(Boolean))) as string[];
    if (uniqueStallNames.length === 0) return;

    // Firestore "in" query 30 values வரைக்கும் மட்டும் support பண்ணும்.
    // 30-க்கு மேல stalls இருந்தா, batch பண்ணி multiple queries run பண்றோம்.
    const batches: string[][] = [];
    for (let i = 0; i < uniqueStallNames.length; i += 30) {
      batches.push(uniqueStallNames.slice(i, i + 30));
    }

    const unsubscribers: (() => void)[] = [];

    batches.forEach((batch) => {
      const q = query(collection(db, "vendors"), where("stallName", "in", batch));
      const unsub = onSnapshot(q, (snap) => {
        setVendorOpenMap(prev => {
          const next = { ...prev };
          snap.docs.forEach((docSnap) => {
            const vendorData = docSnap.data();
            const stallName = vendorData.stallName as string | undefined;
            if (stallName) {
              next[stallName] = vendorData.isOnDuty === true;
            }
          });
          return next;
        });
      });
      unsubscribers.push(unsub);
    });

    return () => unsubscribers.forEach(unsub => unsub());
  }, [foods]);

  useEffect(() => {
    const cleanup = setupVendorListeners();
    return cleanup;
  }, [setupVendorListeners]);

  // ✅ Cart operations
  const addToCart = (food: Food) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === food.id);
      if (existing) {
        return prev.map(i => i.id === food.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...food, quantity: 1 }];
    });
  };

  const removeFromCart = (foodId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === foodId);
      if (!existing) return prev;
      if (existing.quantity === 1) return prev.filter(i => i.id !== foodId);
      return prev.map(i => i.id === foodId ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const getQty = (foodId: string) => cart.find(i => i.id === foodId)?.quantity || 0;

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  // ✅ Group foods by stall
  const groupedFoods = foods
    .filter(food => {
      if (searchQuery && !food.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterType === "veg" && food.foodType !== "veg") return false;
      if (filterType === "nonveg" && food.foodType !== "nonveg") return false;
      return true;
    })
    .reduce((groups, food) => {
      const stall = food.stallName || "Other";
      if (!groups[stall]) groups[stall] = [];
      groups[stall].push(food);
      return groups;
    }, {} as Record<string, Food[]>);

  // ✅ Firestore-ல price string-ஆ (extra space/decimal issue) save ஆயிருந்தாலும் clean number-ஆ parse பண்றோம்
  const cleanPrice = (raw: unknown): number => {
    if (typeof raw === "number") return raw;
    const numeric = parseFloat(String(raw).replace(/\s+/g, "").trim());
    return isNaN(numeric) ? 0 : numeric;
  };

  const finalPrice = (food: Food) => {
    const basePrice = cleanPrice(food.price);
    if (food.offer && food.offer > 0) {
      return Math.round(basePrice - (basePrice * food.offer) / 100);
    }
    return basePrice;
  };

  if (!mounted) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3 mb-3">
          <button onClick={() => router.back()} className="p-2 bg-card rounded-full border border-border flex-shrink-0">
            <ArrowLeft size={18} />
          </button>
          <h1 className="text-lg font-bold text-foreground truncate">{categoryName || "Category"}</h1>
          <button onClick={() => router.push("/cart")} className="ml-auto p-2 bg-card rounded-full border border-border relative flex-shrink-0">
            <ShoppingCart size={18} />
            {totalItems > 0 && (
              <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                {totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center bg-card border border-border rounded-xl px-3 py-2 mb-2">
          <Search size={14} className="text-muted mr-2 flex-shrink-0" />
          <input
            type="text"
            placeholder="Search food..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-foreground text-sm outline-none placeholder:text-muted"
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "veg", "nonveg"] as const).map(type => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${filterType === type ? "bg-primary text-white" : "bg-card border border-border text-muted"}`}
            >
              {type === "all" ? "All" : type === "veg" ? "🟢 Veg" : "🔴 Non-Veg"}
            </button>
          ))}
        </div>
      </div>

      {/* Food List */}
      <div className="flex-1 p-4 space-y-6">
        {loading ? (
          <div className="grid grid-cols-1 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-card rounded-2xl border border-border p-3 flex gap-3 animate-pulse">
                <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-xl flex-shrink-0" />
                <div className="flex-1 space-y-2 py-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(groupedFoods).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <ShoppingCart size={48} className="mb-4 opacity-50" />
            <p className="font-semibold">No items found</p>
            <p className="text-xs mt-1">Try changing filters or search</p>
          </div>
        ) : (
          Object.entries(groupedFoods).map(([stallName, stallFoods]) => {
            const isStallOpen = vendorOpenMap[stallName] ?? true;
            return (
              <div key={stallName}>
                {/* Stall header */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${isStallOpen ? "bg-green-500" : "bg-red-500"}`} />
                  <h2 className="font-bold text-foreground text-base">{stallName}</h2>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isStallOpen ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                    {isStallOpen ? "Open" : "Closed"}
                  </span>
                </div>

                {/* Food items */}
                <div className="space-y-3">
                  {stallFoods.map(food => {
                    const qty = getQty(food.id);
                    const price = finalPrice(food);
                    return (
                      <div key={food.id} className="bg-card rounded-2xl border border-border p-3 flex gap-3">
                        {/* Food image */}
                        <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                          {food.image ? (
                            <Image
                              src={optimizeCloudinaryUrl(food.image)}
                              alt={food.name}
                              fill
                              className={`object-cover ${!isStallOpen ? "grayscale" : ""}`}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs text-center px-2">No Image</div>
                          )}
                        </div>

                        {/* Food info */}
                        <div className="flex-1 flex flex-col justify-between min-w-0">
                          <div>
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${food.foodType === "nonveg" ? "border-red-500" : "border-green-500"}`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${food.foodType === "nonveg" ? "bg-red-500" : "bg-green-500"}`} />
                              </span>
                              <h3 className="font-bold text-foreground text-sm line-clamp-1">{food.name}</h3>
                            </div>
                            {food.description && (
                              <p className="text-xs text-muted line-clamp-2 mb-1">{food.description}</p>
                            )}
                            {food.rating && (
                              <p className="text-xs text-yellow-500 mb-1">⭐ {food.rating}</p>
                            )}
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-foreground text-sm">₹{price}</span>
                              {Boolean(food.offer) && food.offer! > 0 && (
                                <span className="line-through text-xs text-muted">₹{cleanPrice(food.price)}</span>
                              )}
                              {Boolean(food.offer) && food.offer! > 0 && (
                                <span className="text-xs text-green-500 font-semibold">{food.offer}% off</span>
                              )}
                            </div>
                          </div>

                          {/* Add/Remove buttons */}
                          <div className="mt-2 flex justify-end">
                            {!isStallOpen ? (
                              <div className="w-28 py-2 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold flex items-center justify-center text-center leading-tight px-1">
                                Currently Closed
                              </div>
                            ) : qty === 0 ? (
                              <button
                                onClick={() => addToCart(food)}
                                className="w-28 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-md"
                              >
                                <Plus size={15} /> ADD
                              </button>
                            ) : (
                              <div className="w-28 flex items-center justify-between bg-primary rounded-xl px-3 py-2 shadow-md">
                                <button onClick={() => removeFromCart(food.id)} className="text-white active:scale-90 transition-transform">
                                  <Minus size={16} />
                                </button>
                                <span className="text-white font-bold text-base">{qty}</span>
                                <button onClick={() => addToCart(food)} className="text-white active:scale-90 transition-transform">
                                  <Plus size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Cart bottom bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50">
          <button
            onClick={() => router.push("/cart")}
            className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-between px-5 shadow-xl active:scale-98 transition-transform"
          >
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-sm font-bold px-2.5 py-0.5 rounded-lg">{totalItems}</span>
              <span className="font-semibold text-base">item{totalItems > 1 ? "s" : ""} added</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base">VIEW CART</span>
              <ShoppingCart size={20} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}