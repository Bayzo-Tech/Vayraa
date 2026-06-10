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
      const razorpayOrderId = payment.order_id;

      // Query the existing order by razorpay_order_id
      const existingOrder = await db
        .collection("orders")
        .where("razorpay_order_id", "==", razorpayOrderId)
        .limit(1)
        .get();

      if (!existingOrder.empty) {
        // Order exists — update status only, never insert
        const orderDoc = existingOrder.docs[0];
        await orderDoc.ref.update({
          status: "placed",
          payment_status: "paid",
        });
        return NextResponse.json({ status: "updated" });
      }

      // Order not found — do NOT create a new document, just log and continue
      console.warn(`Webhook: No order found for razorpay_order_id ${razorpayOrderId}. Skipping.`);
    }
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
