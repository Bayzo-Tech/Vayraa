"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ShoppingCart, ClipboardList, User, Home, Star } from "lucide-react";
import { useUser } from "@/context/UserContext";

interface Category {
  id: string;
  name: string;
  image?: string;
  area?: string;
  rating?: number;
}

interface Banner {
  id: string;
  imageUrl: string;
  orderIndex?: number;
}

interface CartItem {
  quantity: number;
}

// ✅ NEW: Cloudinary URL optimize — auto format/quality + capped width, so home page
// images (banner, category cards) download faster instead of full-resolution originals
const optimizeCloudinaryUrl = (url?: string, width = 500): string => {
  if (!url) return "";
  if (!url.includes("res.cloudinary.com")) return url;
  if (url.includes("f_auto") || url.includes("q_auto")) return url;
  return url.replace("/upload/", `/upload/f_auto,q_auto,w_${width}/`);
};

export default function HomePage() {
  const router = useRouter();
  const { area } = useUser();
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [searchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [customerName, setCustomerName] = useState("there");
  const [cartCount, setCartCount] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const bannerInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.name) setCustomerName(user.name.split(" ")[0]);
      }
      const cartStr = localStorage.getItem("bayzo_cart");
      if (cartStr) {
        const cart: CartItem[] = JSON.parse(cartStr);
        setCartCount(cart.reduce((sum, i) => sum + i.quantity, 0));
      }
    } catch { }
  }, [mounted]);

  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const snap = await getDocs(query(collection(db, "banners"), orderBy("orderIndex", "asc")));
        setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
      } catch {
        try {
          const snap = await getDocs(collection(db, "banners"));
          setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
        } catch {
          setBanners([]);
        }
      }
    };
    fetchBanners();
  }, []);

  useEffect(() => {
    if (banners.length <= 1) return;
    bannerInterval.current = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 2000);
    return () => { if (bannerInterval.current) clearInterval(bannerInterval.current); };
  }, [banners]);

  const fetchCategories = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      setAllCategories(snap.docs.map(d => ({ id: d.id, ...d.data() } as Category)));
    } catch { }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const filteredCategories = allCategories.filter(cat => {
    if (searchQuery && !cat.name.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }
    if (!area) return true;
    if (!cat.area) return true;
    const catArea = cat.area.toLowerCase().trim();
    const selectedArea = area.toLowerCase().trim();
    return catArea === selectedArea || catArea === "both";
  });

  if (!mounted) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background px-4 py-3 flex items-center justify-between border-b border-border">
        <button onClick={() => router.push("/area")} className="p-2 text-foreground">
          <div className="flex flex-col gap-1.5">
            <span className="w-5 h-0.5 bg-foreground block rounded-full"></span>
            <span className="w-5 h-0.5 bg-foreground block rounded-full"></span>
            <span className="w-5 h-0.5 bg-foreground block rounded-full"></span>
          </div>
        </button>
        <h1 className="text-lg font-bold text-foreground">Hello, {customerName}!</h1>
        <button
          onClick={() => router.push("/profile")}
          className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm"
        >
          {customerName.charAt(0).toUpperCase()}
        </button>
      </div>

      {/* Hero Banner */}
      <div className="relative w-full h-52 overflow-hidden">
        {banners.length > 0 ? (
          <>
            {banners.map((banner, idx) => (
              <div
                key={banner.id}
                onClick={() => router.push(`/banner/${banner.id}`)}
                className={`absolute inset-0 transition-opacity duration-700 cursor-pointer ${idx === currentBanner ? "opacity-100" : "opacity-0"}`}
              >
                {/* ✅ CHANGED: optimized + width-capped Cloudinary URL for the banner image */}
                <Image src={optimizeCloudinaryUrl(banner.imageUrl, 800)} alt={`Banner ${idx + 1}`} fill className="object-cover" />
              </div>
            ))}
            {banners.length > 1 && (
              <div className="absolute bottom-14 left-0 right-0 flex justify-center gap-1.5 z-10">
                {banners.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => setCurrentBanner(idx)}
                    className={`h-1.5 rounded-full transition-all ${idx === currentBanner ? "bg-white w-4" : "bg-white/50 w-1.5"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full bg-primary flex items-center justify-center px-6">
            <p className="text-white text-xl font-bold text-center">
              What Beach Food Do You Want Today? 🏖️
            </p>
          </div>
        )}
      </div>

      {/* Stalls */}
      <div className="px-4 mt-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-foreground">Stalls</h2>
          {area && (
            <span className="text-xs text-muted bg-card border border-border px-2 py-1 rounded-full">
              📍 {area}
            </span>
          )}
        </div>

        {filteredCategories.length === 0 ? (
          <div className="text-center py-8 text-muted text-sm">
            {searchQuery
              ? `No categories found for "${searchQuery}"`
              : area
              ? `No categories available in ${area}`
              : "No categories available"}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => router.push(`/category/${cat.id}`)}
                className="relative rounded-2xl overflow-hidden bg-card border border-border aspect-square active:scale-95 transition-all shadow-sm"
              >
                {cat.image ? (
                  // ✅ CHANGED: optimized + width-capped Cloudinary URL — category cards are small, 400px is plenty
                  <Image src={optimizeCloudinaryUrl(cat.image, 400)} alt={cat.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <span className="text-4xl">🍽️</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

                {cat.rating && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-lg">
                    <Star size={12} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-white text-xs font-bold">{cat.rating}</span>
                  </div>
                )}

                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white font-bold text-sm text-left">{cat.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fixed Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="flex items-center justify-around py-2 px-4">
          <button onClick={() => router.push("/home")} className="flex flex-col items-center gap-0.5 py-1 px-3">
            <Home size={22} className="text-primary" />
            <span className="text-[10px] font-semibold text-primary">Home</span>
          </button>
          <button onClick={() => router.push("/cart")} className="flex flex-col items-center gap-0.5 py-1 px-3 relative">
            <div className="relative">
              <ShoppingCart size={22} className="text-muted" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {cartCount}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold text-muted">Cart</span>
          </button>
          <button
            onClick={() => {
              const hasSession = document.cookie.split("; ").some(row => row.trim().startsWith("bayzo_session="));
              router.push(hasSession ? "/history" : "/login?redirect=/history");
            }}
            className="flex flex-col items-center gap-0.5 py-1 px-3"
          >
            <ClipboardList size={22} className="text-muted" />
            <span className="text-[10px] font-semibold text-muted">Orders</span>
          </button>
          <button
            onClick={() => router.push("/profile")}
            className="flex flex-col items-center gap-0.5 py-1 px-3"
          >
            <User size={22} className="text-muted" />
            <span className="text-[10px] font-semibold text-muted">Profile</span>
          </button>
        </div>
      </div>

    </div>
  );
}