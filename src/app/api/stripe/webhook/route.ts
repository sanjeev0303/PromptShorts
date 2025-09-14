import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil'
})

export async function POST(req: Request) {
    try {
        const body = await req.text()
        const signature = req.headers.get('stripe-signature') as string
        const webHookSecret = process.env.STRIPE_WEBHOOK_SECRET

        if (!webHookSecret) {
            return new Response('Webhook secret not present or expired buddy', { status: 400 })
        }

        const event = stripe.webhooks.constructEvent(body, signature, webHookSecret)
        console.log('Webhook event received:', event.type)

        // Handle both one-time payments and subscriptions
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object as Stripe.Checkout.Session
            const userId = session.metadata?.userId
            const priceId = session.metadata?.priceId

            console.log('Processing checkout session:', { userId, priceId, mode: session.mode })

            const creditMap: Record<string, number> = {
                'price_1S6vMXRbGZsirPwsz8Sp9jpK': 1,  // Starter - 1 video
                'price_1S6vMXRbGZsirPwskYXip72J': 25, // Pro - 25 videos
                'price_1S6vMXRbGZsirPws49d6mNwL': 150 // Enterprise - 150 videos
            }

            const creditsToAdd = creditMap[priceId || ''] || 0

            if (userId && creditsToAdd > 0) {
                await prisma.user.upsert({
                    where: { userId: userId },
                    create: {
                        userId: userId,
                        email: '', // Will be updated by user action
                        credits: creditsToAdd
                    },
                    update: {
                        credits: {
                            increment: creditsToAdd
                        }
                    }
                })
                console.log(`✅ Added ${creditsToAdd} credits to user ${userId}`)

                // If this was a subscription created for one-time payment, cancel it immediately
                if (session.mode === 'subscription' && session.subscription) {
                    try {
                        await stripe.subscriptions.update(session.subscription as string, {
                            cancel_at_period_end: true
                        })
                        console.log(`✅ Subscription ${session.subscription} scheduled for cancellation`)
                    } catch (error) {
                        console.error('Failed to cancel subscription:', error)
                    }
                }
            } else {
                console.log('❌ No credits to add:', { userId, priceId, creditsToAdd })
            }
        }

        // Handle subscription events for recurring payments
        if (event.type === 'invoice.payment_succeeded') {
            const invoice = event.data.object as any
            console.log('Recurring payment succeeded for invoice:', invoice.id)
            // Handle recurring subscription payments if needed in the future
        }        return new Response('OK', { status: 200 })
    } catch (error) {
        console.error('Webhook error:', error)
        return new Response('Webhook error', { status: 400 })
    }
}
