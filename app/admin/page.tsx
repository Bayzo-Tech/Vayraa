"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@/context/UserContext";
import { db } from "@/lib/firebase";
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from "firebase/firestore";
import { ArrowLeft, ShieldAlert } from "lucide-react";

interface Order {
  id: string;
  phone: string;
  location: { area: string; zone: string };
  items: { name: string; quantity: number; price: number }[];
  itemTotal: number;
  deliveryFee: number;
  totalAmount: number;
  paymentId: string;
  paymentStatus: string;
  orderStatus: string;
  createdAt: { toDate: () => Date } | null;
}

const STATUS_OPTIONS = ["placed", "preparing", "out for delivery", "delivered"];

export default function AdminPage() {
  const { user, role } = useUser();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading && (!user || role !== "admin")) {
        router.replace("/home");
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [user, role, router, loading]);

  useEffect(() => {
    if (role !== "admin") return;

    const q = query(collection(db, "orders"), orderBy("createdAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Order[];
      
      setOrders(fetchedOrders);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [role]);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    setUpdating(orderId);
    try {
      await updateDoc(doc(db, "orders", orderId), {
        orderStatus: newStatus,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update status");
    } finally {
      setUpdating(null);
    }
  };

  const isToday = (timestamp: any) => {
    if (!timestamp) return true; // assuming very fresh ones without ts yet are today
    const date = timestamp.toDate();
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-muted">Checking authorization...</p>
      </div>
    );
  }

  if (role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center">
        <ShieldAlert size={48} className="text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
      </div>
    );
  }

  const todaysOrders = orders.filter((o) => isToday(o.createdAt));
  const totalRevenue = orders.reduce((sum, o) => sum + (o.paymentStatus === "paid" ? o.totalAmount : 0), 0);

  return (
    <div className="min-h-screen bg-background flex flex-col pb-10">
      <div className="sticky top-0 z-50 bg-background/90 backdrop-blur-md p-4 flex items-center justify-between border-b border-border">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/home")}
            className="p-2 bg-card rounded-full border border-border"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="text-primary">Admin</span> Panel
          </h1>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs text-muted mb-1 uppercase tracking-wider">Total Orders</p>
            <p className="text-2xl font-black text-foreground">{orders.length}</p>
          </div>
          <div className="bg-card border border-primary/30 rounded-2xl p-4 text-center">
            <p className="text-xs text-primary mb-1 uppercase tracking-wider">Today</p>
            <p className="text-2xl font-black text-primary">{todaysOrders.length}</p>
          </div>
          <div className="bg-card border border-border rounded-2xl p-4 text-center">
            <p className="text-xs text-muted mb-1 uppercase tracking-wider">Revenue</p>
            <p className="text-xl font-black text-[#00C853]">₹{totalRevenue}</p>
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold px-1">All Orders</h2>
          {orders.map((order) => (
            <div key={order.id} className="bg-card border border-border rounded-3xl p-5 shadow-sm relative overflow-hidden">
              <div className="flex flex-col gap-4">
                {/* Header: Phone & ID */}
                <div className="flex justify-between items-start border-b border-border pb-4">
                  <div>
                    <h3 className="font-bold text-lg mb-1">{order.phone}</h3>
                    <p className="text-xs font-mono text-muted-foreground">{order.paymentId}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider ${
                    order.paymentStatus === 'paid' ? 'bg-[#00C853]/20 text-[#00C853]' : 'bg-destructive/20 text-destructive'
                  }`}>
                    {order.paymentStatus}
                  </div>
                </div>

                {/* Location & Status Update */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded-md font-semibold">
                      {order.location?.zone}
                    </span>
                    <span>{order.location?.area}</span>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <span className="text-xs text-muted">Status:</span>
                    <select
                      value={order.orderStatus}
                      onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                      disabled={updating === order.id}
                      className="bg-background border border-border text-foreground rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-primary flex-1 md:flex-none disabled:opacity-50"
                    >
                      {STATUS_OPTIONS.map(status => (
                        <option key={status} value={status}>{status.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Items */}
                <div className="bg-background rounded-xl p-3 space-y-2 mt-2">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <div className="flex gap-2">
                        <span className="font-bold text-muted">{item.quantity}x</span>
                        <span>{item.name}</span>
                      </div>
                      <span className="text-muted-foreground">₹{item.price * item.quantity}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-border mt-2 font-bold">
                    <span>Total</span>
                    <span className="text-primary text-lg">₹{order.totalAmount}</span>
                  </div>
                </div>

              </div>
            </div>
          ))}
          
          {orders.length === 0 && (
            <div className="text-center py-10 text-muted">
              No orders found in the database.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
