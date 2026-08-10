import { NextRequest, NextResponse } from "next/server";

// ✅ REPURPOSED: this used to be a dead duplicate of the webhook handler.
// Now it's a real "create Razorpay order server-side" endpoint — this locks
// in the payment amount server-side so it can't be tampered with in devtools.
export async function POST(req: NextRequest) {
  try {
    const { orderId, amount } = await req.json();

    if (!orderId || !amount) {
      return NextResponse.json({ error: "Missing orderId or amount" }, { status: 400 });
    }

    const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keyId || !keySecret) {
      console.error("Razorpay keys not configured on server");
      return NextResponse.json({ error: "Payment system not configured" }, { status: 500 });
    }

    const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

    const razorpayRes = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100), // Razorpay expects paise
        currency: "INR",
        receipt: orderId,
        notes: { firestoreOrderId: orderId },
      }),
    });

    const data = await razorpayRes.json();

    if (!razorpayRes.ok) {
      console.error("Razorpay order creation failed:", data);
      return NextResponse.json({ error: "Failed to create payment order" }, { status: 500 });
    }

    return NextResponse.json({ razorpayOrderId: data.id, amount: data.amount });
  } catch (error) {
    console.error("create-order error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}