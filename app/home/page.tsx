"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { Navbar } from "@/components/Navbar";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

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

export default function HomePage() {
  const router = useRouter();
  const { area } = useUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % SEARCH_PLACEHOLDERS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

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
      } catch (error) {
        console.error("Error fetching categories:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchCategories();
  }, [area, router]);

  const filteredCategories = categories.filter(c =>
    searchQuery.trim() === "" || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!area) return null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Navbar />
      <div className="p-4 space-y-6">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
            </svg>
          </div>
          <input type="text" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-11 pr-4 py-3 bg-white text-black rounded-full shadow-md focus:outline-none focus:ring-2 focus:ring-primary transition-shadow placeholder:text-gray-400"
            placeholder={SEARCH_PLACEHOLDERS[placeholderIndex]}
          />
        </div>

        <h2 className="text-xl font-bold text-foreground">Categories</h2>

        {loading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm flex flex-col animate-pulse">
                <div className="h-32 w-full bg-gray-200 dark:bg-gray-800"></div>
                <div className="p-3 flex justify-center">
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-800 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredCategories.length > 0 ? (
          <div className="grid grid-cols-2 gap-4">
            {filteredCategories.map((cat) => (
              // ✅ FIX: onClick navigate to category food list
              <div key={cat.id}
                onClick={() => router.push(`/category/${cat.id}`)}
                className="bg-card rounded-2xl overflow-hidden border border-border shadow-sm flex flex-col cursor-pointer hover:border-primary transition-colors active:scale-95">
                <div className="relative h-32 w-full bg-gray-100 flex items-center justify-center">
                  {cat.image ? (
                    <Image src={cat.image} alt={cat.name} fill className="object-cover" />
                  ) : (
                    <span className="text-gray-400 text-sm">No Image</span>
                  )}
                </div>
                <div className="p-3 text-center">
                  <h3 className="font-semibold text-foreground text-sm line-clamp-1">{cat.name}</h3>
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
    </div>
  );
}