import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function POST(request: Request) {
    try {
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ success: false, message: 'Order ID required' }, { status: 400 });
        }

        // Get order from Firestore
        const orderRef = adminDb.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        const orderData = orderSnap.data()!;

        // ✅ Delivery Partner phone number fetch
        const deliveryPartnerPhone = orderData.deliveryPartnerPhone || '';

        if (!deliveryPartnerPhone) {
            return NextResponse.json(
                { success: false, message: 'Delivery partner not assigned yet' },
                { status: 400 }
            );
        }

        // 4-digit OTP generate
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        // ✅ FIXED: removed the in-memory global.Map — dead weight, OTP is already
        // saved to Firestore below (handoverOtp field), which is what verification
        // actually checks. The Map doesn't survive across serverless instances.

        // ✅ Send SMS to Delivery Partner - Template #1 (214468)
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
                'authorization': process.env.FAST2SMS_API_KEY!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                route: 'dlt',
                sender_id: 'VAYRAA',
                message: '214468',
                variables_values: otp,
                flash: 0,
                numbers: deliveryPartnerPhone,
            }),
        });

        const data = await response.json();
        console.log('Handover OTP SMS:', JSON.stringify(data));

        if (data.return === true) {
            // Save OTP in Firestore
            await orderRef.update({
                handoverOtp: otp,
                handoverOtpSentAt: new Date(),
                handoverOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
            });

            return NextResponse.json({ success: true, message: 'OTP sent to delivery partner' });
        } else {
            return NextResponse.json(
                { success: false, message: data.message?.[0] || 'SMS send failed' },
                { status: 400 }
            );
        }

    } catch (error) {
        console.error('Send Handover OTP Error:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}