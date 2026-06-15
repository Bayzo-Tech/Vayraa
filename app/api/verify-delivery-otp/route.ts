import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

declare global {
    // eslint-disable-next-line no-var
    var deliveryOtpStore: Map<string, { otp: string; expiry: number; orderId: string }>;
}
if (!global.deliveryOtpStore) {
    global.deliveryOtpStore = new Map();
}

export async function POST(request: Request) {
    try {
        const { orderId, otp } = await request.json();

        if (!orderId || !otp) {
            return NextResponse.json({ success: false, message: 'Order ID and OTP required' }, { status: 400 });
        }

        const stored = global.deliveryOtpStore.get(orderId);

        // Check in-memory first
        if (stored) {
            if (Date.now() > stored.expiry) {
                global.deliveryOtpStore.delete(orderId);
                return NextResponse.json({ success: false, message: 'OTP expired' }, { status: 400 });
            }
            if (stored.otp !== otp) {
                return NextResponse.json({ success: false, message: 'Invalid OTP' }, { status: 400 });
            }
        } else {
            // Fallback: check Firestore
            const orderRef = adminDb.collection('orders').doc(orderId);
            const orderSnap = await orderRef.get();

            if (!orderSnap.exists) {
                return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
            }

            const orderData = orderSnap.data()!;

            if (!orderData.deliveryOtp) {
                return NextResponse.json({ success: false, message: 'No OTP found. Please request again.' }, { status: 400 });
            }

            if (orderData.deliveryOtp !== otp) {
                return NextResponse.json({ success: false, message: 'Invalid OTP' }, { status: 400 });
            }

            const expiry = orderData.deliveryOtpExpiry?.toDate?.();
            if (expiry && new Date() > expiry) {
                return NextResponse.json({ success: false, message: 'OTP expired' }, { status: 400 });
            }
        }

        // ✅ OTP correct - mark as delivered
        const orderRef = adminDb.collection('orders').doc(orderId);
        await orderRef.update({
            orderStatus: 'delivered',
            deliveredAt: new Date(),
            deliveryOtp: null, // clear OTP after use
        });

        global.deliveryOtpStore.delete(orderId);

        return NextResponse.json({ success: true, message: 'Order marked as delivered!' });

    } catch (error) {
        console.error('Verify Delivery OTP Error:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}