import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { adminAuth, db } from "@/lib/firebase-admin";

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

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = await req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
      return NextResponse.json({ success: false, message: "Missing payment details" }, { status: 400 });
    }

    const keySecret = process.env.RAZORPAY_KEY_SECRET || "";

    // ✅ Core security check: recompute the signature Razorpay would have
    // generated for a REAL payment, and compare. A faked payment ID will
    // never produce a matching signature.
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      console.error(`Signature mismatch for order ${orderId}`);
      return NextResponse.json({ success: false, message: "Payment verification failed" }, { status: 400 });
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    const orderData = orderSnap.data();

    // ✅ Make sure the order actually belongs to the person paying
    if (orderData?.customerId !== decodedToken.uid) {
      return NextResponse.json({ success: false, message: "Not authorized for this order" }, { status: 403 });
    }

    await orderRef.set({
      paymentStatus: "paid",
      status: "placed",
      orderStatus: "placed",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("verify-payment error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}