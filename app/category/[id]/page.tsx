"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useRouter, useParams } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { collection, getDocs, query, where, doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Plus, Minus, ShoppingCart } from "lucide-react";

type Food = {
  id: string;
  name: string;
  description: string;
  price: number;
  offer: number;
  image: string;
  stallName: string;
  categoryId: string;
  area: string;
  foodType?: string;
};

type Category = {
  id: string;
  name: string;
  description: string;
  image: string;
  area: string;
};

type CartItem = Food & { quantity: number };

export default function CategoryPage() {
  const router = useRouter();
  const params = useParams();
  const { area } = useUser();
  const categoryId = params.id as string;

  const [mounted, setMounted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [category, setCategory] = useState<Category | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [filterType, setFilterType] = useState<"all" | "veg" | "nonveg">("all");
  const [vendorOpenMap, setVendorOpenMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  // ✅ Load cart from localStorage on mount
  useEffect(() => {
    if (!mounted) return;
    if (typeof window === "undefined") return;
    try {
      const saved = localStorage.getItem("bayzo_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch (e) {
      console.error(e);
    }
    setIsLoaded(true);
  }, [mounted]);

  // ✅ Save cart to localStorage whenever it changes
  useEffect(() => {
    if (!mounted || !isLoaded) return;
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("bayzo_cart", JSON.stringify(cart));
    } catch (e) {
      console.error(e);
    }
  }, [cart, mounted, isLoaded]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const catDoc = await getDoc(doc(db, "categories", categoryId));
      if (catDoc.exists()) {
        setCategory({ id: catDoc.id, ...catDoc.data() } as Category);
      }
      const cleanArea = area?.split(" (")[0] || "";
      const foodsSnap = await getDocs(query(
        collection(db, "foods"),
        where("categoryId", "==", categoryId),
        where("area", "in", [cleanArea, "Both"])
      ));
      const allFoods = foodsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Food));
      setFoods(allFoods);

      // ✅ FIX: Array.from instead of spread (downlevelIteration error fix)
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setLoading(false);
    }
  }, [area, categoryId]);

  useEffect(() => {
    if (!area) { router.replace("/area"); return; }
    fetchData();
  }, [area, categoryId, router, fetchData]);

  // ✅ Real-time vendor isOnDuty listener — rebuilds vendorOpenMap on every Firestore update
  useEffect(() => {
    const uniqueStallNames = Array.from(new Set(foods.map(f => f.stallName).filter(Boolean)));
    if (uniqueStallNames.length === 0) return;
    const unsubscribe = onSnapshot(
      query(collection(db, "vendors"), where("stallName", "in", uniqueStallNames)),
      (snapshot) => {
        const openMap: Record<string, boolean> = {};
        snapshot.docs.forEach(d => {
          const data = d.data();
          if (data.stallName) openMap[data.stallName] = data.isOnDuty || false;
        });
        setVendorOpenMap(openMap);
      }
    );
    return () => unsubscribe();
  }, [foods]);

  const addToCart = (food: Food) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === food.id);
      if (existing) return prev.map(i => i.id === food.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...food, quantity: 1 }];
    });
  };

  const removeFromCart = (foodId: string) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === foodId);
      if (existing?.quantity === 1) return prev.filter(i => i.id !== foodId);
      return prev.map(i => i.id === foodId ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const getQty = (foodId: string) => cart.find(i => i.id === foodId)?.quantity || 0;
  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  function finalPrice(food: Food) {
    if (food.offer > 0) return Math.round(food.price - (food.price * food.offer / 100));
    return food.price;
  }

  const filteredFoods = foods.filter(f => {
    const matchSearch = searchQuery.trim() === "" ||
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.stallName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchType = filterType === "all" || f.foodType === filterType;
    return matchSearch && matchType;
  });

  const groupedByStall = filteredFoods.reduce((acc, food) => {
    const stall = food.stallName || "Other";
    if (!acc[stall]) acc[stall] = [];
    acc[stall].push(food);
    return acc;
  }, {} as Record<string, Food[]>);

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()}
          className="p-2 rounded-full hover:bg-card transition-colors">
          <ArrowLeft size={22} className="text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-xl text-foreground leading-tight">{category?.name || "Category"}</h1>
          <p className="text-xs text-muted">{area}</p>
        </div>
        <button onClick={() => router.push("/cart")}
          className="relative p-2 rounded-full hover:bg-card transition-colors">
          <ShoppingCart size={24} className="text-foreground" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
              {totalItems}
            </span>
          )}
        </button>
      </div>

      {/* Category Banner */}
      {category?.image && (
        <div className="relative h-44 w-full overflow-hidden">
          <Image src={category.image} alt={category.name} fill priority className="object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute bottom-4 left-4">
            <h2 className="text-white font-bold text-2xl">{category.name}</h2>
            {category.description && <p className="text-white/80 text-sm mt-0.5">{category.description}</p>}
          </div>
        </div>
      )}

      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dishes..."
            className="block w-full pl-9 pr-4 py-2.5 bg-card text-foreground rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary text-sm"
          />
        </div>

        {/* Veg / Non-veg filter */}
        <div className="flex gap-2">
          <button
            onClick={() => setFilterType(filterType === "veg" ? "all" : "veg")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold transition-all ${filterType === "veg" ? "border-green-500 bg-green-500/10 text-green-500" : "border-border text-muted"}`}>
            <span className="w-4 h-4 rounded-sm border-2 border-green-500 flex items-center justify-center flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
            </span>
            Veg
          </button>
          <button
            onClick={() => setFilterType(filterType === "nonveg" ? "all" : "nonveg")}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-full border text-sm font-semibold transition-all ${filterType === "nonveg" ? "border-red-500 bg-red-500/10 text-red-500" : "border-border text-muted"}`}>
            <span className="w-4 h-4 rounded-sm border-2 border-red-500 flex items-center justify-center flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
            </span>
            Non-Veg
          </button>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-4 py-5 border-b border-border/40 animate-pulse">
                <div className="flex-1">
                  <div className="w-5 h-5 rounded-sm bg-gray-200 dark:bg-gray-800 mb-2"></div>
                  <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
                  <div className="h-6 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-2"></div>
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-800 rounded"></div>
                  <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-800 rounded mt-1"></div>
                </div>
                <div className="flex-shrink-0 flex flex-col items-center gap-2.5">
                  <div className="w-28 h-28 rounded-2xl bg-gray-200 dark:bg-gray-800"></div>
                  <div className="w-28 py-4 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredFoods.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <ShoppingCart size={48} className="mb-4 opacity-40" />
            <p className="font-semibold text-base">No items found</p>
          </div>
        ) : (
          Object.entries(groupedByStall).map(([stallName, stallFoods]) => {
            const isStallOpen = vendorOpenMap[stallName] !== false;

            return (
              <div key={stallName}>
                {/* Stall header */}
                <div className="flex items-center gap-2 py-3 border-b border-border mb-1">
                  <span className="text-lg">🏪</span>
                  <h3 className="font-bold text-foreground text-base">{stallName}</h3>
                  {isStallOpen ? (
                    <span className="text-xs text-green-500 font-bold bg-green-500/10 px-2 py-0.5 rounded-full ml-1">🟢 Open</span>
                  ) : (
                    <span className="text-xs text-red-500 font-bold bg-red-500/10 px-2 py-0.5 rounded-full ml-1">🔴 Closed</span>
                  )}
                  <span className="text-xs text-muted ml-auto">{stallFoods.length} items</span>
                </div>

                {stallFoods.map((food, idx) => {
                  const qty = getQty(food.id);
                  const price = finalPrice(food);
                  return (
                    <div key={food.id}
                      className={`flex gap-4 py-5 ${idx < stallFoods.length - 1 ? "border-b border-border/40" : ""}`}>
                      {/* Left: food info */}
                      <div className="flex-1 min-w-0">
                        <span className={`w-5 h-5 rounded-sm border-2 flex items-center justify-center mb-2 ${food.foodType === "nonveg" ? "border-red-500" : "border-green-500"}`}>
                          <span className={`w-2.5 h-2.5 rounded-full ${food.foodType === "nonveg" ? "bg-red-500" : "bg-green-500"}`}></span>
                        </span>
                        <h4 className="font-bold text-foreground text-base leading-snug mb-1">{food.name}</h4>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold text-foreground text-lg">₹{price}</span>
                          {food.offer > 0 && (
                            <>
                              <span className="line-through text-sm text-muted">₹{food.price}</span>
                              <span className="text-xs text-green-500 font-bold bg-green-500/10 px-1.5 py-0.5 rounded-full">{food.offer}% off</span>
                            </>
                          )}
                        </div>
                        {food.description && (
                          <p className="text-sm text-muted line-clamp-2 leading-relaxed">{food.description}</p>
                        )}
                      </div>

                      {/* Right: image + button */}
                      <div className="flex-shrink-0 flex flex-col items-center gap-2.5">
                        <div className="w-28 h-28 rounded-2xl overflow-hidden bg-gray-100 relative shadow-sm">
                          {food.image ? (
                            <Image src={food.image} alt={food.name} fill className={`object-cover ${!isStallOpen ? "grayscale" : ""}`} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs text-center px-2">No Image</div>
                          )}
                        </div>

                        {!isStallOpen ? (
                          <div className="w-28 py-2 bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl text-xs font-bold flex items-center justify-center text-center leading-tight px-1">
                            Currently Closed
                          </div>
                        ) : qty === 0 ? (
                          <button
                            onClick={() => addToCart(food)}
                            className="w-28 py-2 bg-primary text-white rounded-xl text-sm font-bold flex items-center justify-center gap-1 active:scale-95 transition-transform shadow-md">
                            <Plus size={15} /> ADD
                          </button>
                        ) : (
                          <div className="w-28 flex items-center justify-between bg-primary rounded-xl px-3 py-2 shadow-md">
                            <button onClick={() => removeFromCart(food.id)}
                              className="text-white active:scale-90 transition-transform">
                              <Minus size={16} />
                            </button>
                            <span className="text-white font-bold text-base">{qty}</span>
                            <button onClick={() => addToCart(food)}
                              className="text-white active:scale-90 transition-transform">
                              <Plus size={16} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* ✅ Cart bottom bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-0 left-0 right-0 p-4 z-50">
          <button
            onClick={() => router.push("/cart")}
            className="w-full bg-primary text-white rounded-2xl py-4 flex items-center justify-between px-5 shadow-xl active:scale-98 transition-transform">
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