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
        const { orderId } = await request.json();

        if (!orderId) {
            return NextResponse.json({ success: false, message: 'Order ID required' }, { status: 400 });
        }

        const orderRef = adminDb.collection('orders').doc(orderId);
        const orderSnap = await orderRef.get();

        if (!orderSnap.exists) {
            return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
        }

        const orderData = orderSnap.data()!;
        const customerPhone = orderData.customerPhone || orderData.displayPhone || '';

        if (!customerPhone) {
            return NextResponse.json({ success: false, message: 'Customer phone not found' }, { status: 400 });
        }

        // 4-digit OTP generate
        const otp = Math.floor(1000 + Math.random() * 9000).toString();

        global.deliveryOtpStore.set(orderId, {
            otp,
            expiry: Date.now() + 10 * 60 * 1000,
            orderId,
        });

        // ✅ Template #2 (214467) - Delivery to Customer
        const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
            method: 'POST',
            headers: {
                'authorization': process.env.FAST2SMS_API_KEY!,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                route: 'dlt',
                sender_id: 'VAYRAA',
                message: '214467',
                variables_values: otp,
                flash: 0,
                numbers: customerPhone,
            }),
        });

        const data = await response.json();
        console.log('Delivery OTP SMS response:', JSON.stringify(data));

        if (data.return === true) {
            await orderRef.update({
                deliveryOtp: otp,
                deliveryOtpSentAt: new Date(),
                deliveryOtpExpiry: new Date(Date.now() + 10 * 60 * 1000),
            });

            return NextResponse.json({ success: true, message: 'OTP sent to customer' });
        } else {
            return NextResponse.json(
                { success: false, message: data.message?.[0] || 'SMS send failed' },
                { status: 400 }
            );
        }

    } catch (error) {
        console.error('Send Delivery OTP Error:', error);
        return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
    }
}