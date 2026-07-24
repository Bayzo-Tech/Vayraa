"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, ShoppingCart, Plus, Minus } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore";

interface Banner {
  id: string;
  title?: string;
  imageUrl?: string;
  categoryIds: string[];
  discountPercent: number;
  status: string;
}

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
}

interface CartItem extends Food {
  quantity: number;
}

const optimizeCloudinaryUrl = (url?: string): string => {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("f_auto") || url.includes("q_auto")) return url;
  return url.replace("/upload/", "/upload/f_auto,q_auto/");
};

export default function BannerPage() {
  const params = useParams();
  const router = useRouter();
  const bannerId = params?.id as string;

  const [banner, setBanner] = useState<Banner | null>(null);
  const [foods, setFoods] = useState<Food[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ✅ Load cart from localStorage — same key used by category/food/cart pages
  useEffect(() => {
    if (!mounted) return;
    try {
      const saved = localStorage.getItem("bayzo_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch { }
  }, [mounted]);

  useEffect(() => {
    if (!mounted) return;
    try {
      localStorage.setItem("bayzo_cart", JSON.stringify(cart));
    } catch { }
  }, [cart, mounted]);

  // ✅ Fetch banner + its foods
  useEffect(() => {
    if (!bannerId) return;
    setLoading(true);
    const fetchBannerAndFoods = async () => {
      try {
        const bannerSnap = await getDoc(doc(db, "banners", bannerId));
        if (!bannerSnap.exists()) {
          router.replace("/home");
          return;
        }
        const bannerData = { id: bannerSnap.id, ...bannerSnap.data() } as Banner;
        setBanner(bannerData);

        const categoryIds = bannerData.categoryIds || [];
        if (categoryIds.length === 0) {
          setFoods([]);
          setLoading(false);
          return;
        }

        // Firestore "in" query supports max 30 values — batch if needed
        const batches: string[][] = [];
        for (let i = 0; i < categoryIds.length; i += 30) {
          batches.push(categoryIds.slice(i, i + 30));
        }

        let allFoods: Food[] = [];
        for (const batch of batches) {
          const q = query(collection(db, "foods"), where("categoryId", "in", batch));
          const snap = await getDocs(q);
          allFoods = [...allFoods, ...snap.docs.map(d => ({ id: d.id, ...d.data() } as Food))];
        }
        setFoods(allFoods);
      } catch (e) {
        console.error("Error fetching banner:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchBannerAndFoods();
  }, [bannerId, router]);

  const getQty = (foodId: string) => cart.find(i => i.id === foodId)?.quantity || 0;

  // ✅ Banner discount applies on top of the food's base price — replaces the food's own offer
  // (banner promo takes priority so pricing is unambiguous for the customer)
  const finalPrice = (food: Food) => {
    const discount = banner?.discountPercent || 0;
    if (discount > 0) {
      return Math.round(food.price - (food.price * discount) / 100);
    }
    if (food.offer && food.offer > 0) {
      return Math.round(food.price - (food.price * food.offer) / 100);
    }
    return food.price;
  };

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

  const totalItems = cart.reduce((sum, i) => sum + i.quantity, 0);

  // ✅ Group foods by stall — same pattern as category page
  const groupedFoods = foods.reduce((groups, food) => {
    const stall = food.stallName || "Other";
    if (!groups[stall]) groups[stall] = [];
    groups[stall].push(food);
    return groups;
  }, {} as Record<string, Food[]>);

  if (!mounted || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!banner) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col pb-24">

      {/* Banner image header */}
      <div className="relative h-48 w-full bg-card">
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 z-10 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={() => router.push("/cart")}
          className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white"
        >
          <ShoppingCart size={18} />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
              {totalItems}
            </span>
          )}
        </button>

        {banner.imageUrl ? (
          <Image src={banner.imageUrl} alt={banner.title || "Banner"} fill className="object-cover" />
        ) : (
          <div className="w-full h-full bg-primary" />
        )}

        {banner.discountPercent > 0 && (
          <div className="absolute bottom-4 left-4 bg-green-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-lg">
            {banner.discountPercent}% OFF
          </div>
        )}
      </div>

      {/* Title */}
      {banner.title && (
        <div className="px-4 pt-4">
          <h1 className="text-xl font-bold text-foreground">{banner.title}</h1>
        </div>
      )}

      {/* Food List */}
      <div className="flex-1 p-4 space-y-6">
        {Object.keys(groupedFoods).length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <ShoppingCart size={48} className="mb-4 opacity-50" />
            <p className="font-semibold">No items found for this offer</p>
          </div>
        ) : (
          Object.entries(groupedFoods).map(([stallName, stallFoods]) => (
            <div key={stallName}>
              <h2 className="font-bold text-foreground text-base mb-3">{stallName}</h2>
              <div className="space-y-3">
                {stallFoods.map(food => {
                  const qty = getQty(food.id);
                  const price = finalPrice(food);
                  return (
                    <div key={food.id} className="bg-card rounded-2xl border border-border p-3 flex gap-3">
                      <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {food.image ? (
                          <Image
                            src={optimizeCloudinaryUrl(food.image)}
                            alt={food.name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs text-center px-2">No Image</div>
                        )}
                      </div>

                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center flex-shrink-0 ${food.foodType === "nonveg" ? "border-red-500" : "border-green-500"}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${food.foodType === "nonveg" ? "bg-red-500" : "bg-green-500"}`} />
                            </span>
                            <h3 className="font-bold text-foreground text-sm line-clamp-1">{food.name}</h3>
                          </div>
                          {food.rating && (
                            <p className="text-xs text-yellow-500 mb-1">⭐ {food.rating}</p>
                          )}
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-foreground text-sm">₹{price}</span>
                            {price < food.price && (
                              <span className="line-through text-xs text-muted">₹{food.price}</span>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex justify-end">
                          {qty === 0 ? (
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
          ))
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