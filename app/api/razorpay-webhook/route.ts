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
      const paymentId = payment.id;
      const amount = payment.amount / 100;
      const contact = payment.contact || "";

      // Check if order already saved by client
      const existingOrder = await db
        .collection("orders")
        .where("paymentId", "==", paymentId)
        .limit(1)
        .get();

      if (!existingOrder.empty) {
        // Order exists — just make sure status is placed
        const orderDoc = existingOrder.docs[0];
        if (orderDoc.data().orderStatus === "pending") {
          await orderDoc.ref.update({
            orderStatus: "placed",
            status: "placed",
            paymentStatus: "paid",
          });
        }
        return NextResponse.json({ status: "updated" });
      }

      // Order not found — do NOT create a new document, just log and continue
      console.warn(`Webhook: No pending order found for paymentId ${paymentId}. Skipping.`);
    }
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Webhook failed" }, { status: 500 });
  }
}
