"use client";

import { useUser } from "@/context/UserContext";
import { useCart } from "@/context/CartContext";
import { ChevronDown, ShoppingCart, ScrollText, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function Navbar() {
  const { area, zone, role } = useUser();
  const { items } = useCart();
  const router = useRouter();

  const cartItemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const displayLocation = area 
    ? `${area.charAt(0).toUpperCase() + area.slice(1)}${zone ? ` (Zone ${zone})` : ""}`
    : "Select Location";

  return (
    <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
      <div 
        className="flex items-center gap-1 cursor-pointer"
        onClick={() => router.push("/area")}
      >
        <div className="flex flex-col">
          <span className="text-xs text-primary font-bold tracking-wider">DELIVERING TO</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-foreground truncate max-w-[200px]">
              {displayLocation}
            </span>
            <ChevronDown size={16} className="text-primary" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {role === "admin" && (
          <Link href="/admin" className="p-2 bg-card rounded-full border border-border">
            <ShieldCheck size={20} className="text-foreground" />
          </Link>
        )}
        
        <Link 
          href="/history" 
          className="p-2 bg-gradient-to-tr from-orange-500/20 to-orange-500/10 hover:from-orange-500/30 hover:to-orange-500/20 rounded-full border border-orange-500/30 transition-all duration-300 shadow-sm shadow-orange-500/10 active:scale-95 group"
        >
          <ScrollText size={20} className="text-primary group-hover:scale-110 transition-transform duration-300" />
        </Link>

        <Link href="/cart" className="relative p-2 bg-card rounded-full border border-border">
          <ShoppingCart size={20} className="text-foreground" />
          {cartItemCount > 0 && (
            <div className="absolute -top-1 -right-1 bg-primary text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full">
              {cartItemCount}
            </div>
          )}
        </Link>
      </div>
    </div>
  );
}
