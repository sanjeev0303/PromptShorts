import { currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-08-27.basil'
})

export async function POST(req: Request) {
    try {
        const user = await currentUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        const { priceId } = await req.json()

        // Retrieve price details to determine if it's recurring or one-time
        const price = await stripe.prices.retrieve(priceId)
        const mode = price.type === 'recurring' ? 'subscription' : 'payment'

        console.log(`Creating checkout session for price ${priceId} in ${mode} mode`)

        // For subscriptions, we might want to cancel at end of billing period to make it one-time
        const sessionConfig: any = {
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: mode,
            success_url: `${req.headers.get('origin')}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get('origin')}/cancel`,
            metadata: {
                userId: user.id,
                priceId: priceId
            }
        }

        // For subscriptions, immediately cancel after first payment to simulate one-time payment
        if (mode === 'subscription') {
            sessionConfig.subscription_data = {
                metadata: {
                    cancel_after_first_payment: 'true',
                    userId: user.id,
                    priceId: priceId
                }
            }
        }

        const session = await stripe.checkout.sessions.create(sessionConfig)

        return NextResponse.json({ url: session.url })
    } catch (error) {
        console.error('Stripe checkout error:', error)
        return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 })
    }
}
