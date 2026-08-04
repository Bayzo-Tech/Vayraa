"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { ArrowLeft, Copy, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import BottomNav from "@/components/BottomNav";

interface Order {
  id: string;
  items: { name: string; quantity: number }[];
  totalAmount: number;
  paymentId: string;
  orderStatus: string;
  createdAt: { toDate: () => Date; toMillis?: () => number; seconds?: number } | null;
}

const statusColors: Record<string, string> = {
  placed: "bg-orange-50 text-primary",
  preparing: "bg-yellow-50 text-yellow-600",
  "out for delivery": "bg-blue-50 text-blue-600",
  delivered: "bg-green-50 text-green-600",
};

export default function OrdersPage() {
  const { user } = useUser();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!user && !loading) {
        router.replace("/");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [user, router, loading]);

  useEffect(() => {
    if (!user) return;

    const fetchOrders = async () => {
      try {
        const normalizedUid =
          user.phoneNumber?.replace("+91", "91") || user.uid;

        const idsToCheck = Array.from(
          new Set([user.uid, normalizedUid])
        );

        let allOrders: Order[] = [];

        for (const uid of idsToCheck) {
          const q = query(
            collection(db, "orders"),
            where("userId", "==", uid)
          );
          const snapshot = await getDocs(q);
          const fetched = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Order[];
          allOrders = [...allOrders, ...fetched];
        }

        const seen = new Set();
        allOrders = allOrders.filter((o) => {
          if (seen.has(o.id)) return false;
          seen.add(o.id);
          return true;
        });

        allOrders.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
          const bTime = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
          return bTime - aTime;
        });

        setOrders(allOrders);
      } catch (error) {
        console.error("Error fetching orders:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, [user]);

  const copyToClipboard = (e: React.MouseEvent, text: string, id: string) => {
    e.preventDefault();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (timestamp: { toDate: () => Date } | null) => {
    if (!timestamp) return "Just now";
    const date = timestamp.toDate();
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "numeric",
    }).format(date);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col pb-10">
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md p-4 flex items-center gap-4 border-b border-gray-100">
        <button
          onClick={() => router.push("/")}
          className="p-2 bg-gray-50 rounded-full border border-gray-200"
        >
          <ArrowLeft size={20} className="text-black" />
        </button>
        <h1 className="text-xl font-bold text-black">Order History</h1>
      </div>

      <div className="p-4 flex-1 pb-24">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <span className="text-6xl mb-4">🏖️</span>
            <h2 className="text-xl font-semibold mb-2 text-black">No orders yet</h2>
            <p className="text-gray-500">Looks like you haven&apos;t placed any orders.</p>
            <Link
              href="/home"
              className="mt-6 bg-primary text-white px-6 py-3 rounded-full font-semibold active:scale-95 transition-transform"
            >
              Start Exploring
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block bg-white border border-gray-100 shadow-sm rounded-2xl p-4 active:scale-[0.98] transition-transform"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">{formatDate(order.createdAt)}</p>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-gray-400">
                        {order.paymentId?.slice(0, 12)}...
                      </span>
                      <button
                        onClick={(e) => copyToClipboard(e, order.paymentId, order.id)}
                        className="text-primary hover:text-primary/80 transition-colors"
                      >
                        {copiedId === order.id ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColors[order.orderStatus] || statusColors.placed}`}>
                    {order.orderStatus}
                  </div>
                </div>

                <div className="space-y-1 mb-4">
                  {order.items?.map((item, i) => (
                    <div key={i} className="text-sm text-black">
                      <span className="font-semibold">{item.quantity}x</span> {item.name}
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-100 pt-3 flex justify-between items-center">
                  <span className="text-gray-500 text-sm">Total Paid</span>
                  <span className="text-lg font-black text-black">₹{order.totalAmount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <BottomNav />

    </div>
  );
}