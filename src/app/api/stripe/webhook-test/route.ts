import { NextResponse } from 'next/server'

export async function GET() {
    return NextResponse.json({
        message: 'Webhook endpoint is working',
        timestamp: new Date().toISOString()
    })
}

export async function POST(req: Request) {
    try {
        const body = await req.text()
        const signature = req.headers.get('stripe-signature')

        console.log('📧 Webhook received:', {
            signature: signature?.substring(0, 20) + '...',
            bodyLength: body.length,
            headers: Object.fromEntries(req.headers.entries())
        })

        return NextResponse.json({ received: true })
    } catch (error) {
        console.error('Webhook test error:', error)
        return NextResponse.json({ error: 'Test failed' }, { status: 400 })
    }
}
