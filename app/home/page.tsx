"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Search, ShoppingCart, ClipboardList, User, Home } from "lucide-react";

interface Category {
  id: string;
  name: string;
  image?: string;
  area?: string;
}

interface Banner {
  id: string;
  imageUrl: string;
  orderIndex?: number;
}

interface CartItem {
  quantity: number;
}

export default function HomePage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [mounted, setMounted] = useState(false);
  const [customerName, setCustomerName] = useState("there");
  const [cartCount, setCartCount] = useState(0);
  const [currentBanner, setCurrentBanner] = useState(0);
  const [area, setArea] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
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
      const savedArea = localStorage.getItem("vayra_area");
      if (savedArea) setArea(savedArea);
      const cartStr = localStorage.getItem("bayzo_cart");
      if (cartStr) {
        const cart: CartItem[] = JSON.parse(cartStr);
        setCartCount(cart.reduce((sum, i) => sum + i.quantity, 0));
      }
    } catch { }
  }, [mounted]);

  // ✅ Fetch banners
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const snap = await getDocs(query(collection(db, "banners"), orderBy("orderIndex", "asc")));
        setBanners(snap.docs.map(d => ({ id: d.id, ...d.data() } as Banner)));
      } catch {
        // fallback: try without orderBy
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

  // ✅ Auto-slide banner every 2 seconds
  useEffect(() => {
    if (banners.length <= 1) return;
    bannerInterval.current = setInterval(() => {
      setCurrentBanner(prev => (prev + 1) % banners.length);
    }, 2000);
    return () => { if (bannerInterval.current) clearInterval(bannerInterval.current); };
  }, [banners]);

  // ✅ Fetch ALL categories first, then filter by area
  const fetchCategories = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "categories"));
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() } as Category));
      setAllCategories(all);
    } catch { }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ✅ Filter categories by area
  useEffect(() => {
    if (!area || allCategories.length === 0) {
      setCategories(allCategories);
      return;
    }
    const filtered = allCategories.filter(cat => {
      if (!cat.area) return true; // no area field = show everywhere
      const catArea = cat.area.toLowerCase().trim();
      const selectedArea = area.toLowerCase().trim();
      return catArea === selectedArea || catArea === "both";
    });
    setCategories(filtered);
  }, [area, allCategories]);

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogout = () => {
    try {
      localStorage.removeItem("user");
      document.cookie = "bayzo_session=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    } catch { }
    router.push("/area");
  };

  if (!mounted) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col pb-20">

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background px-4 py-3 flex items-center justify-between border-b border-border">
        <button
          onClick={() => router.push("/area")}
          className="p-2 text-foreground"
        >
          <div className="flex flex-col gap-1.5">
            <span className="w-5 h-0.5 bg-foreground block rounded-full"></span>
            <span className="w-5 h-0.5 bg-foreground block rounded-full"></span>
            <span className="w-5 h-0.5 bg-foreground block rounded-full"></span>
          </div>
        </button>
        <h1 className="text-lg font-bold text-foreground">Hello, {customerName}!</h1>
        <div className="relative">
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm"
          >
            {customerName.charAt(0).toUpperCase()}
          </button>
          {showProfileMenu && (
            <div className="absolute top-11 right-0 bg-card border border-border rounded-xl shadow-lg py-2 w-36 z-50">
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-500/10"
              >
                🚪 Logout
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Hero Banner */}
      <div className="relative w-full h-52 overflow-hidden">
        {banners.length > 0 ? (
          <>
            {banners.map((banner, idx) => (
              <div
                key={banner.id}
                className={`absolute inset-0 transition-opacity duration-700 ${idx === currentBanner ? "opacity-100" : "opacity-0"}`}
              >
                <Image
                  src={banner.imageUrl}
                  alt={`Banner ${idx + 1}`}
                  fill
                  className="object-cover"
                />
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

        {/* ✅ FIXED: Search bar — white background, NOT orange */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3 z-10">
          <div className="flex items-center bg-white rounded-2xl border border-gray-200 px-3 py-2.5 shadow-lg">
            <Search size={16} className="text-gray-400 mr-2 flex-shrink-0" />
            <input
              type="text"
              placeholder={`Search for ${categories[0]?.name || "food"}...`}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-gray-800 text-sm outline-none placeholder:text-gray-400"
            />
          </div>
        </div>
      </div>

      {/* ✅ Categories grid — click goes to /category/[id] */}
      <div className="px-4 mt-4">
        <h2 className="text-base font-bold text-foreground mb-3">Categories</h2>
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
                  <Image
                    src={cat.image}
                    alt={cat.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <span className="text-4xl">🍽️</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white font-bold text-sm text-left">{cat.name}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ✅ Fixed Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
        <div className="flex items-center justify-around py-2 px-4">
          <button
            onClick={() => router.push("/home")}
            className="flex flex-col items-center gap-0.5 py-1 px-3"
          >
            <Home size={22} className="text-primary" />
            <span className="text-[10px] font-semibold text-primary">Home</span>
          </button>
          <button
            onClick={() => router.push("/cart")}
            className="flex flex-col items-center gap-0.5 py-1 px-3 relative"
          >
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
            onClick={() => setShowProfileMenu(!showProfileMenu)}
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