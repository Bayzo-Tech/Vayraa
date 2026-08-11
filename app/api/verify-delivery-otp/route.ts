import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { orderId, otp } = await request.json();

        if (!orderId || !otp) {
            return NextResponse.json({ success: false, message: 'Order ID and OTP required' }, { status: 400 });
        }

        // ✅ FIXED: in-memory Map removed (send-delivery-otp no longer writes to it,
        // and it never survived across serverless instances anyway). Firestore is
        // now the single source of truth, same pattern as send-otp/verify-otp.
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

        // ✅ OTP correct - mark as delivered
        await orderRef.update({
            orderStatus: 'delivered',
            deliveredAt: new Date(),
            deliveryOtp: null, // clear OTP after use
        });

        return NextResponse.json({ success: true, message: 'Order marked as delivered!' });

    } catch (error) {
        console.error('Verify Delivery OTP Error:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}