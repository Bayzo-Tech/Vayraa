import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.replace('Bearer ', '').trim();
    if (!idToken) {
      return NextResponse.json({ success: false, message: 'Not authenticated' }, { status: 401 });
    }

    let decodedToken;
    try {
      decodedToken = await adminAuth.verifyIdToken(idToken);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid session' }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const { couponId, orderId } = await request.json();

    if (!couponId || !orderId) {
      return NextResponse.json({ success: false, message: 'Missing couponId or orderId' }, { status: 400 });
    }

    const couponRef = adminDb.collection('coupons').doc(couponId);

    // ✅ Firestore transaction — read + check + write happen atomically.
    // If two requests hit this at the same time, Firestore automatically
    // retries the loser using fresh data, so usageLimit can never be
    // oversold and oneTimePerUser can never be bypassed by a race.
    const result = await adminDb.runTransaction(async (transaction) => {
      const couponSnap = await transaction.get(couponRef);
      if (!couponSnap.exists) {
        throw new Error('Coupon not found');
      }
      const coupon = couponSnap.data() as {
        status?: string;
        expiry?: string;
        usageLimit?: number | null;
        usageCount?: number;
        oneTimePerUser?: boolean;
        usedBy?: string[];
      };

      if (coupon.status === 'Inactive') {
        throw new Error('Coupon is no longer active');
      }

      const today = new Date().toISOString().split('T')[0];
      if (coupon.expiry && coupon.expiry < today) {
        throw new Error('Coupon has expired');
      }

      if (coupon.usageLimit && (coupon.usageCount || 0) >= coupon.usageLimit) {
        throw new Error('Coupon usage limit reached');
      }

      const usedByList = coupon.usedBy || [];
      if (coupon.oneTimePerUser && usedByList.includes(uid)) {
        throw new Error('Coupon already used by this user');
      }

      transaction.update(couponRef, {
        usageCount: (coupon.usageCount || 0) + 1,
        usedBy: [...usedByList, uid],
        lastUsedOrderId: orderId,
      });

      return { success: true };
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to apply coupon';
    console.error('apply-coupon error:', message);
    return NextResponse.json({ success: false, message }, { status: 400 });
  }
}