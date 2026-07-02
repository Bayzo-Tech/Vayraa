"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Menu, Home, ShoppingCart, ClipboardList, User as UserIcon, Star } from "lucide-react";

const SEARCH_PLACEHOLDERS = [
  "Search for Burgers...",
  "Search for Ice Cream...",
  "Search for Waffles...",
  "Search for Fish Fry..."
];

type Category = {
  id: string;
  name: string;
  description: string;
  image: string;
  area: string;
};

type Food = {
  id: string;
  name: string;
  image: string;
  stallName: string;
  categoryId: string;
  area: string;
  rating?: number;
};

type Banner = {
  id: string;
  imageUrl: string;
  orderIndex: number;
};

export default function HomePage() {
  const router = useRouter();
  const { area } = useUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [bannerIndex, setBannerIndex] = useState(0);
  const [customerName, setCustomerName] = useState("Guest");
  const [cartCount, setCartCount] = useState(0);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // ✅ Customer name from localStorage 'user'
  useEffect(() => {
    try {
      const raw = localStorage.getItem("user");
      if (raw) {
        const parsed = JSON.parse(raw);
        setCustomerName(parsed?.name || parsed?.displayName || "Guest");
      }
    } catch {
      setCustomerName("Guest");
    }
  }, []);

  // ✅ Cart count from localStorage 'bayzo_cart'
  useEffect(() => {
    const readCart = () => {
      try {
        const raw = localStorage.getItem("bayzo_cart");
        const cart = raw ? JSON.parse(raw) : [];
        const count = Array.isArray(cart)
          ? cart.reduce((sum: number, i: { quantity?: number }) => sum + (i.quantity || 0), 0)
          : 0;
        setCartCount(count);
      } catch {
        setCartCount(0);
      }
    };
    readCart();
    window.addEventListener("storage", readCart);
    const interval = setInterval(readCart, 2000);
    return () => {
      window.removeEventListener("storage", readCart);
      clearInterval(interval);
    };
  }, []);

  // ✅ Banners from Firestore
  useEffect(() => {
    const fetchBanners = async () => {
      try {
        const snapshot = await getDocs(
          query(collection(db, "banners"), orderBy("orderIndex", "asc"))
        );
        const allBanners = snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, imageUrl: data.imageUrl || "", orderIndex: data.orderIndex ?? 0 };
        });
        setBanners(allBanners.filter(b => b.imageUrl));
      } catch (error) {
        console.error("Error fetching banners:", error);
      }
    };
    fetchBanners();
  }, []);

  // ✅ Auto-slide banners every 2 seconds
  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % banners.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [banners]);

  useEffect(() => {
    if (!area) { router.replace("/area"); return; }
    const cleanArea = area.split(" (")[0];

    const fetchCategories = async () => {
      setLoading(true);
      try {
        // ✅ FIX: Fetch both exact area AND "Both" categories efficiently
        const snapshot = await getDocs(
          query(collection(db, "categories"), where("area", "in", [cleanArea, "Both"]))
        );

        const allCategories = snapshot.docs.map(doc => {
          const data = doc.data();
          return { id: doc.id, name: data.name || "", description: data.description || "", image: data.image || "", area: data.area || "" };
        });

        setCategories(allCategories.filter(c => c.name));

        const foodsSnap = await getDocs(
          query(collection(db, "foods"), where("area", "in", [cleanArea, "Both"]))
        );
        const allFoods = foodsSnap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "",
            image: data.image || "",
            stallName: data.stallName || "",
            categoryId: data.categoryId || "",
            area: data.area || "",
            rating: data.rating,
          };
        });
        setFoods(allFoods.filter(f => f.name));
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [area, router]);

  const filteredFoods = foods.filter(f => {
    const matchTab = activeTab === "all" || f.categoryId === activeTab;
    const matchSearch = searchQuery.trim() === "" || f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchTab && matchSearch;
  });

  const handleLogout = () => {
    localStorage.removeItem("user");
    document.cookie = "bayzo_session=; path=/; max-age=0";
    router.push("/login");
  };

  if (!area) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-background sticky top-0 z-20 border-b border-border">
        <button onClick={() => router.push("/area")} className="p-2 -ml-2 rounded-full hover:bg-card transition-colors">
          <Menu size={24} className="text-foreground" />
        </button>
        <h1 className="font-bold text-lg text-foreground truncate px-2">Hello, {customerName}!</h1>
        <button
          onClick={() => setShowProfileMenu(true)}
          className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold flex-shrink-0"
        >
          {customerName.charAt(0).toUpperCase()}
        </button>
      </div>

      {/* Hero Banner */}
      <div className="relative w-full h-48 overflow-hidden">
        {banners.length > 0 ? (
          <>
            {banners.map((b, idx) => (
              <div
                key={b.id}
                className="absolute inset-0 transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(${(idx - bannerIndex) * 100}%)` }}
              >
                <Image src={b.imageUrl} alt="banner" fill className="object-cover" priority={idx === 0} />
              </div>
            ))}
            <div className="absolute bottom-16 left-0 right-0 flex justify-center gap-1.5">
              {banners.map((_, idx) => (
                <span
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${idx === bannerIndex ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-primary flex items-center justify-center p-6">
            <p className="text-white font-bold text-xl text-center leading-snug">
              What Beach Food Do You Want Today? 🏖️
            </p>
          </div>
        )}

        {/* Search bar overlaid at bottom */}
        <div className="absolute -bottom-6 left-4 right-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
              </svg>
            </div>
            <input type="text" value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-11 pr-4 py-3 bg-white text-black rounded-full shadow-lg focus:outline-none focus:ring-2 focus:ring-primary transition-shadow placeholder:text-gray-400"
              placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
            />
          </div>
        </div>
      </div>

      <div className="px-4 pt-10 pb-4 space-y-5">
        {/* Category Tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setActiveTab("all")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activeTab === "all" ? "bg-primary text-white" : "bg-card text-muted border border-border"}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${activeTab === cat.id ? "bg-primary text-white" : "bg-card text-muted border border-border"}`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Food Grid */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden shadow-sm flex flex-col animate-pulse">
                <div className="h-32 w-full bg-gray-200 dark:bg-gray-800"></div>
                <div className="p-3 space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-800 rounded"></div>
                  <div className="h-3 w-1/2 bg-gray-200 dark:bg-gray-800 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredFoods.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredFoods.map((food) => (
              <div key={food.id}
                onClick={() => router.push(`/food/${food.id}`)}
                className="bg-white dark:bg-card rounded-2xl overflow-hidden shadow-md flex flex-col cursor-pointer active:scale-95 transition-transform">
                <div className="relative h-32 w-full bg-gray-100 flex items-center justify-center">
                  {food.image ? (
                    <Image src={food.image} alt={food.name} fill className="object-cover" />
                  ) : (
                    <span className="text-gray-400 text-sm">No Image</span>
                  )}
                </div>
                <div className="p-3">
                  <h3 className="font-semibold text-foreground text-sm line-clamp-1">{food.name}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={13} className="text-yellow-400 fill-yellow-400" />
                    <span className="text-xs text-muted font-medium">{(food.rating ?? 4.5).toFixed(1)}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 line-clamp-1">{food.stallName}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-muted">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>No items available in this area</p>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-border flex items-center justify-around py-2">
        <button onClick={() => router.push("/home")} className="flex flex-col items-center gap-0.5 px-4 py-1 text-primary">
          <Home size={22} />
          <span className="text-[11px] font-semibold">Home</span>
        </button>
        <button onClick={() => router.push("/cart")} className="relative flex flex-col items-center gap-0.5 px-4 py-1 text-muted">
          <ShoppingCart size={22} />
          {cartCount > 0 && (
            <span className="absolute -top-1 right-2 bg-primary text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
              {cartCount}
            </span>
          )}
          <span className="text-[11px] font-semibold">Cart</span>
        </button>
        <button onClick={() => router.push("/history")} className="flex flex-col items-center gap-0.5 px-4 py-1 text-muted">
          <ClipboardList size={22} />
          <span className="text-[11px] font-semibold">Orders</span>
        </button>
        <button onClick={() => setShowProfileMenu(true)} className="flex flex-col items-center gap-0.5 px-4 py-1 text-muted">
          <UserIcon size={22} />
          <span className="text-[11px] font-semibold">Profile</span>
        </button>
      </div>

      {/* Profile Menu Modal */}
      {showProfileMenu && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-end justify-center" onClick={() => setShowProfileMenu(false)}>
          <div className="bg-background rounded-t-2xl w-full max-w-md p-4 pb-8 space-y-2" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-2" />
            <p className="text-center font-bold text-foreground pb-2">{customerName}</p>
            <button
              onClick={handleLogout}
              className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold"
            >
              Logout
            </button>
            <button
              onClick={() => setShowProfileMenu(false)}
              className="w-full py-3 rounded-xl bg-card text-foreground font-semibold border border-border"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
