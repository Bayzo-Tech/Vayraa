import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

declare global {
    // eslint-disable-next-line no-var
    var handoverOtpStore: Map<string, { otp: string; expiry: number; orderId: string }>;
}
if (!global.handoverOtpStore) {
    global.handoverOtpStore = new Map();
}

export async function POST(request: Request) {
    try {
        const { orderId, otp } = await request.json();

        if (!orderId || !otp) {
            return NextResponse.json({ success: false, message: 'Order ID and OTP required' }, { status: 400 });
        }

        const stored = global.handoverOtpStore.get(orderId);

        if (stored) {
            if (Date.now() > stored.expiry) {
                global.handoverOtpStore.delete(orderId);
                return NextResponse.json({ success: false, message: 'OTP expired' }, { status: 400 });
            }
            if (stored.otp !== otp) {
                return NextResponse.json({ success: false, message: 'Invalid OTP' }, { status: 400 });
            }
        } else {
            // Fallback: Firestore check
            const orderRef = adminDb.collection('orders').doc(orderId);
            const orderSnap = await orderRef.get();

            if (!orderSnap.exists) {
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            const orderData = orderSnap.data()!;

            if (!orderData.handoverOtp || orderData.handoverOtp !== otp) {
                return NextResponse.json({ success: false, message: 'Invalid OTP' }, { status: 400 });
            }

            const expiry = orderData.handoverOtpExpiry?.toDate?.();
            if (expiry && new Date() > expiry) {
                return NextResponse.json({ success: false, message: 'OTP expired' }, { status: 400 });
            }
        }

        // ✅ OTP correct - update order status
        const orderRef = adminDb.collection('orders').doc(orderId);
        await orderRef.update({
            orderStatus: 'out_for_delivery',
            handoverAt: new Date(),
            handoverOtp: null,
        });

        global.handoverOtpStore.delete(orderId);

        return NextResponse.json({ success: true, message: 'Handover confirmed!' });

    } catch (error) {
        console.error('Verify Handover OTP Error:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}