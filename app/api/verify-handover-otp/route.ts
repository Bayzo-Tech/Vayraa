import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { orderId, otp } = await request.json();

        if (!orderId || !otp) {
            return NextResponse.json({ success: false, message: 'Order ID and OTP required' }, { status: 400 });
        }

        // ✅ FIXED: in-memory Map removed (send-handover-otp no longer writes to it,
        // and it never survived across serverless instances anyway). Firestore is
        // now the single source of truth, same pattern as send-otp/verify-otp.
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

        // ✅ OTP correct - update order status
        await orderRef.update({
            orderStatus: 'out_for_delivery',
            handoverAt: new Date(),
            handoverOtp: null,
        });

        return NextResponse.json({ success: true, message: 'Handover confirmed!' });

    } catch (error) {
        console.error('Verify Handover OTP Error:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}