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
      const razorpayPaymentId = payment.id; // pay_XXXXXXX

      // Query by razorpayPaymentId (client saves this in handler)
      let existingOrder = await db
        .collection("orders")
        .where("razorpayPaymentId", "==", razorpayPaymentId)
        .limit(1)
        .get();

      // Fallback: try razorpay_order_id match
      if (existingOrder.empty) {
        const razorpayOrderId = payment.order_id;
        if (razorpayOrderId) {
          existingOrder = await db
            .collection("orders")
            .where("razorpayOrderId", "==", razorpayOrderId)
            .limit(1)
            .get();
        }
      }

      if (!existingOrder.empty) {
        const orderDoc = existingOrder.docs[0];
        await orderDoc.ref.update({
          status: "placed",
          orderStatus: "placed",
          paymentStatus: "paid",
          payment_status: "paid",
          razorpayPaymentId: razorpayPaymentId,
          updatedAt: new Date().toISOString(),
        });
        console.log(`✅ Webhook updated order ${orderDoc.id}`);
        return NextResponse.json({ status: "updated" });
      }

      console.warn(`⚠️ No order found for paymentId ${razorpayPaymentId}`);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
