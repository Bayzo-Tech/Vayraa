"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, ShoppingCart, ClipboardList, User } from "lucide-react";

interface CartItemLite {
  quantity: number;
}

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    try {
      const cartStr = localStorage.getItem("bayzo_cart");
      if (cartStr) {
        const cart: CartItemLite[] = JSON.parse(cartStr);
        setCartCount(cart.reduce((sum, i) => sum + i.quantity, 0));
      }
    } catch { }
  }, [pathname]);

  const goToOrders = () => {
    const hasSession = document.cookie.split("; ").some(row => row.trim().startsWith("bayzo_session="));
    router.push(hasSession ? "/history" : "/login?redirect=/history");
  };

  const navItems = [
    {
      key: "home",
      label: "Home",
      Icon: Home,
      active: pathname === "/home",
      onClick: () => router.push("/home"),
    },
    {
      key: "cart",
      label: "Cart",
      Icon: ShoppingCart,
      active: pathname === "/cart",
      onClick: () => router.push("/cart"),
      badge: cartCount,
    },
    {
      key: "orders",
      label: "Orders",
      Icon: ClipboardList,
      active: pathname === "/history" || pathname === "/orders",
      onClick: goToOrders,
    },
    {
      key: "profile",
      label: "Profile",
      Icon: User,
      active: false,
      onClick: () => router.push("/home"),
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map(({ key, label, Icon, active, onClick, badge }) => (
          <button
            key={key}
            onClick={onClick}
            className="flex flex-col items-center gap-0.5 py-1 px-3"
          >
            <div className="relative">
              <Icon size={22} className={active ? "text-primary" : "text-muted"} />
              {badge !== undefined && badge > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-primary text-white text-[9px] font-bold w-4 h-4 flex items-center justify-center rounded-full">
                  {badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-semibold ${active ? "text-primary" : "text-muted"}`}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}