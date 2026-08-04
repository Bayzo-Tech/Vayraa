"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Package, Copy, CheckCircle2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";

interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  createdAt: { toDate?: () => Date } | string | number | null;
  orderStatus: string;
  razorpayPaymentId?: string;
  items?: OrderItem[];
  vendorName?: string;
  totalAmount?: number;
  customerId?: string;
}

// ✅ CHANGED: light-tint pill colors (design), same status keys/logic as before
const STATUS_COLOR: Record<string, string> = {
  placed: "bg-orange-50 text-primary",
  preparing: "bg-blue-50 text-blue-600",
  ready_for_pickup: "bg-purple-50 text-purple-600",
  out_for_delivery: "bg-amber-50 text-amber-600",
  delivered: "bg-green-50 text-green-600",
  cancelled: "bg-red-50 text-red-600",
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
  const [uid, setUid] = useState<string>("");
  // ✅ NEW: track which order's payment ID was just copied, for the copy-icon feedback (UI only)
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const userId = user.uid || user.phoneNumber?.replace("+", "") || "";
        setUid(userId);
      } else {
        setLoading(false);
      }
    } catch {
      setLoading(false);
    }
  }, [mounted]);

  useEffect(() => {
    if (!uid) return;

    const fetchOrders = () => {
      try {
        const q = query(
          collection(db, "orders"),
          where("customerId", "==", uid),
          orderBy("createdAt", "desc")
        );
        const unsub = onSnapshot(q,
          (snap) => {
            setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
            setLoading(false);
          },
          () => {
            const q2 = query(collection(db, "orders"), where("customerId", "==", uid));
            onSnapshot(q2, (snap) => {
              const list = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
              list.sort((a, b) => {
                const aTime = a.createdAt && typeof a.createdAt === "object" && "toDate" in a.createdAt
                  ? (a.createdAt.toDate?.()?.getTime() ?? 0) : 0;
                const bTime = b.createdAt && typeof b.createdAt === "object" && "toDate" in b.createdAt
                  ? (b.createdAt.toDate?.()?.getTime() ?? 0) : 0;
                return bTime - aTime;
              });
              setOrders(list);
              setLoading(false);
            });
          }
        );
        return unsub;
      } catch {
        setLoading(false);
      }
    };

    const unsub = fetchOrders();
    return () => { if (unsub) unsub(); };
  }, [uid]);

  const formatDate = (ts: Order["createdAt"]) => {
    if (!ts) return "";
    const date = ts && typeof ts === "object" && "toDate" in ts
      ? ts.toDate?.() ?? new Date()
      : new Date(ts as string | number);
    return date.toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  // ✅ NEW: copy payment ID to clipboard, UI-only addition matching design's copy icon
  const copyPaymentId = (e: React.MouseEvent, orderId: string, paymentId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(paymentId);
    setCopiedId(orderId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  if (!mounted || loading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md px-4 py-3 flex items-center gap-3 border-b border-gray-100">
        <button onClick={() => router.back()} className="p-2 bg-gray-50 rounded-full border border-gray-200">
          <ArrowLeft size={18} className="text-black" />
        </button>
        <h1 className="text-lg font-bold text-black">Order History</h1>
      </div>

      <div className="flex-1 p-4 space-y-4 pb-24">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-24 h-24 rounded-full bg-orange-50 flex items-center justify-center mb-4">
              <Package size={40} className="text-primary" />
            </div>
            <h2 className="text-lg font-bold text-black mb-1">No orders yet</h2>
            <p className="text-gray-500 text-sm mb-6">Your order history will appear here</p>
            <button
              onClick={() => router.push("/home")}
              className="bg-primary text-white font-bold px-8 py-3 rounded-full active:scale-95 transition-all"
            >
              Order Now 🏖️
            </button>
          </div>
        ) : (
          orders.map(order => (
            <div
              key={order.id}
              onClick={() => router.push(`/orders/${order.id}`)}
              className="bg-white border border-gray-100 shadow-sm rounded-2xl overflow-hidden cursor-pointer active:scale-[0.98] transition-all"
            >
              <div className="px-4 pt-4 flex justify-between items-start gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-gray-400 font-semibold">{formatDate(order.createdAt)}</p>
                  {order.razorpayPaymentId && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <p className="text-xs text-gray-500 font-mono truncate max-w-[130px]">{order.razorpayPaymentId.slice(0, 15)}...</p>
                      <button
                        onClick={(e) => copyPaymentId(e, order.id, order.razorpayPaymentId!)}
                        className="text-gray-400 hover:text-primary transition-colors flex-shrink-0"
                      >
                        {copiedId === order.id ? <CheckCircle2 size={13} className="text-green-500" /> : <Copy size={13} />}
                      </button>
                    </div>
                  )}
                </div>
                <span className={`flex-shrink-0 text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-wide ${STATUS_COLOR[order.orderStatus] || STATUS_COLOR.placed}`}>
                  {STATUS_LABEL[order.orderStatus] || order.orderStatus}
                </span>
              </div>

              <div className="px-4 pt-3.5 pb-1 space-y-2.5">
                {order.items?.slice(0, 2).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                      <span className="text-primary text-xs font-bold">{item.quantity}×</span>
                    </div>
                    <p className="text-sm text-black truncate">{item.name}</p>
                  </div>
                ))}
                {order.items && order.items.length > 2 && (
                  <p className="text-xs text-gray-400 pl-9.5">+{order.items.length - 2} more items</p>
                )}
              </div>

              <div className="mx-4 border-t border-gray-100 mt-2" />

              <div className="flex justify-between items-center px-4 py-4">
                <div className="flex items-center gap-1 text-gray-400 text-xs">
                  <span>🏪</span>
                  <span>{order.vendorName}</span>
                </div>
                <p className="font-black text-black text-base">₹{order.totalAmount}</p>
              </div>

              {['placed', 'preparing', 'out_for_delivery', 'ready_for_pickup'].includes(order.orderStatus) && (
                <button className="w-full bg-orange-50 hover:bg-orange-100 transition-colors py-3.5 flex items-center justify-center gap-2 text-primary text-sm font-bold">
                  Tap to track your order
                  <span className="text-base">→</span>
                </button>
              )}
            </div>
          ))
        )}
      </div>

      <BottomNav />

    </div>
  );
}