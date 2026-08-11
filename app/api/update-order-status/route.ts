import { NextRequest, NextResponse } from "next/server";
import { adminAuth, db } from "@/lib/firebase-admin";

const VALID_STATUSES = ["placed", "preparing", "out for delivery", "delivered"];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || "";
    const idToken = authHeader.replace("Bearer ", "").trim();
    if (!idToken) {
      return NextResponse.json({ success: false, message: "Not authenticated" }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ success: false, message: "Invalid session" }, { status: 401 });
    }

    // ✅ Server-side admin check — matches the "role" field on the user's own
    // Firestore doc (same source app/admin/page.tsx's client-side check reads),
    // so this can't be bypassed by tampering with client state.
    const userSnap = await db.collection("users").doc(decodedToken.uid).get();
    const userRole = userSnap.exists ? userSnap.data()?.role : null;
    if (userRole !== "admin") {
      return NextResponse.json({ success: false, message: "Not authorized" }, { status: 403 });
    }

    const { orderId, newStatus } = await req.json();

    if (!orderId || !newStatus) {
      return NextResponse.json({ success: false, message: "Missing orderId or newStatus" }, { status: 400 });
    }

    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ success: false, message: "Invalid status value" }, { status: 400 });
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    await orderRef.update({ orderStatus: newStatus });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("update-order-status error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}