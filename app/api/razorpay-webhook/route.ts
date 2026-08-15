import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature") || "";
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      const razorpayPaymentId = payment.id;

      // ✅ CHANGED: razorpayOrderId query-க்கு பதிலா, notes-ல client அனுப்பின
      // firestoreOrderId-ஐ வெச்சு direct doc lookup பண்றோம் — query தேவையில்ல,
      // camelCase/snake_case guessing தேவையில்ல
      const firestoreOrderId = payment.notes?.firestoreOrderId;

      if (!firestoreOrderId) {
        console.warn("⚠️ Webhook: no firestoreOrderId in payment.notes, skipping");
        return NextResponse.json({ status: "ok" });
      }

      const orderRef = db.collection("orders").doc(firestoreOrderId);
      const orderSnap = await orderRef.get();

      if (!orderSnap.exists) {
        console.warn(`⚠️ Webhook: order doc ${firestoreOrderId} not found`);
        return NextResponse.json({ status: "ok" });
      }

      await orderRef.set({
        status: "placed",
        orderStatus: "placed",
        paymentStatus: "paid",
        paymentId: razorpayPaymentId,       // ✅ FIX: admin panel reads this field name
        razorpayPaymentId,                  // kept for backward compatibility
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      console.log(`✅ Webhook: Order ${firestoreOrderId} updated to placed+paid`);
      return NextResponse.json({ status: "updated" });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}