"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Package, ChevronRight } from "lucide-react";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  orderStatus: string;
  createdAt: { toDate: () => Date } | string | number | null;
  razorpayPaymentId?: string;
  vendorName?: string;
  totalAmount: number;
  items?: OrderItem[];
}

const STATUS_COLOR: Record<string, string> = {
  placed: "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  preparing: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
  ready_for_pickup: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
  out_for_delivery: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
  delivered: "bg-green-500/20 text-green-400 border border-green-500/30",
  cancelled: "bg-red-500/20 text-red-400 border border-red-500/30",
};

const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  preparing: "Preparing",
  ready_for_pickup: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered ✅",
  cancelled: "Cancelled ❌",
};

export default function HistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    let uid = "";
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        uid = user.uid || "";
      }
    } catch { }

    if (!uid) {
      setLoading(false);
      return;
    }

    // ✅ Real-time onSnapshot — status changes reflect immediately
    const q = query(
      collection(db, "orders"),
      where("customerId", "==", uid),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
      setLoading(false);
    });

    return () => unsub();
  }, [mounted]);

  const formatDate = (ts: Order["createdAt"]) => {
    if (!ts) return "";
    const date = typeof ts === "object" && ts !== null && "toDate" in ts ? ts.toDate() : new Date(ts as string | number);
    return date.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  if (!mounted || loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-border">
        <button onClick={() => router.back()} className="p-2 bg-card rounded-full border border-border">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-bold text-foreground">Order History</h1>
      </div>

      <div className="flex-1 p-4 space-y-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Package size={48} className="text-muted mb-4" />
            <h2 className="text-lg font-bold text-foreground mb-1">No orders yet</h2>
            <p className="text-muted text-sm mb-6">Your order history will appear here</p>
            <button
              onClick={() => router.push("/home")}
              className="bg-primary text-white font-bold px-8 py-3 rounded-xl active:scale-95 transition-all"
            >
              Order Now 🏖️
            </button>
          </div>
        ) : (
          orders.map(order => (
            <div
              key={order.id}
              onClick={() => router.push(`/orders/${order.id}`)}
              className="bg-card border border-border rounded-2xl p-4 cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-xs text-muted">{formatDate(order.createdAt)}</p>
                  <p className="text-xs text-muted font-mono mt-0.5">{order.razorpayPaymentId?.slice(0, 15)}...</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase ${STATUS_COLOR[order.orderStatus] || STATUS_COLOR.placed}`}>
                    {STATUS_LABEL[order.orderStatus] || order.orderStatus}
                  </span>
                  <ChevronRight size={16} className="text-muted" />
                </div>
              </div>

              {/* Items */}
              <div className="space-y-1 mb-3">
                {order.items?.slice(0, 2).map((item: OrderItem, idx: number) => (
                  <p key={idx} className="text-sm text-foreground">
                    <span className="text-primary font-bold">{item.quantity}x</span> {item.name}
                  </p>
                ))}
                {(order.items?.length ?? 0) > 2 && (
                  <p className="text-xs text-muted">+{(order.items?.length ?? 0) - 2} more items</p>
                )}
              </div>

              <div className="flex justify-between items-center border-t border-border pt-3">
                <div className="flex items-center gap-1 text-muted text-xs">
                  <span>🏪</span>
                  <span>{order.vendorName}</span>
                </div>
                <p className="font-bold text-foreground">₹{order.totalAmount}</p>
              </div>

              {/* Active order indicator */}
              {['placed', 'preparing', 'out_for_delivery', 'ready_for_pickup'].includes(order.orderStatus) && (
                <div className="mt-3 flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse inline-block"></span>
                  <p className="text-primary text-xs font-semibold">Tap to track your order →</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}