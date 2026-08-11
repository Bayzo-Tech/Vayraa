import { NextRequest, NextResponse } from "next/server";
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

    const { orderId, vendorId, foodIds, rating, reviewText, photoUrl } = await req.json();

    if (!orderId || !vendorId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ success: false, message: "Missing or invalid review data" }, { status: 400 });
    }

    const orderRef = db.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ success: false, message: "Order not found" }, { status: 404 });
    }

    const orderData = orderSnap.data();

    // ✅ Ownership check — only the customer who placed this order can review it
    if (orderData?.customerId !== decodedToken.uid) {
      return NextResponse.json({ success: false, message: "Not authorized for this order" }, { status: 403 });
    }

    // ✅ Must actually be delivered
    if (orderData?.orderStatus !== "delivered") {
      return NextResponse.json({ success: false, message: "Order is not yet delivered" }, { status: 400 });
    }

    // ✅ One review per order — server-enforced, not just a UI hide
    if (orderData?.reviewed === true) {
      return NextResponse.json({ success: false, message: "This order has already been reviewed" }, { status: 400 });
    }

    const updateAverageRating = async (collectionName: string, docId: string) => {
      const ref = db.collection(collectionName).doc(docId);
      await db.runTransaction(async (transaction) => {
        const snap = await transaction.get(ref);
        const data = snap.exists ? snap.data() : {};
        const currentSum = (data?.ratingSum as number) || 0;
        const currentCount = (data?.ratingCount as number) || 0;
        const newSum = currentSum + rating;
        const newCount = currentCount + 1;
        const newAvg = Math.round((newSum / newCount) * 10) / 10;
        transaction.set(ref, { ratingSum: newSum, ratingCount: newCount, rating: newAvg }, { merge: true });
      });
    };

    // 1. Save the review
    const reviewRef = db.collection("reviews").doc();
    await reviewRef.set({
      orderId,
      vendorId,
      foodIds: foodIds || [],
      rating,
      reviewText: (reviewText || "").trim(),
      photoUrl: photoUrl || "",
      customerId: decodedToken.uid,
      createdAt: new Date(),
    });

    // 2. Mark order as reviewed
    await orderRef.update({ reviewed: true });

    // 3. Update vendor's aggregate rating
    await updateAverageRating("vendors", vendorId);

    // 4. Update each food's + its category's aggregate rating
    for (const foodId of (foodIds || [])) {
      if (!foodId) continue;
      try {
        await updateAverageRating("foods", foodId);
        const foodSnap = await db.collection("foods").doc(foodId).get();
        const categoryId = foodSnap.exists ? (foodSnap.data()?.categoryId as string) : null;
        if (categoryId) {
          await updateAverageRating("categories", categoryId);
        }
      } catch (e) {
        console.error(`Failed to update rating for food ${foodId}:`, e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("submit-review error:", error);
    return NextResponse.json({ success: false, message: "Internal server error" }, { status: 500 });
  }
}