"use server"

import { decreaseCredits } from "@/lib/decrease-credit"
import { prisma } from "@/lib/prisma"
import { videoQueue } from "@/lib/queue"
import { auth, currentUser } from "@clerk/nextjs/server"
import { randomUUID } from "crypto"

export interface VideoConfig {
  duration: '15' | '30' | '60'
  imageCount: 3 | 4 | 5 | 6 | 8
  aspectRatio: '9:16' | '16:9' | '1:1'
}

export const createVideo = async (prompt: string) => {
    const videoId = randomUUID()
    const user = await currentUser()
    const userId = user?.id

    if (!userId) {
        return null
    }

    await prisma.video.create({
        data: {
            videoId,
            userId,
            prompt,
            processing: true
        }
    })

    await decreaseCredits(userId)

    await videoQueue.add('generate-video', { videoId })
    console.log('job added to queue successfully')

    return { videoId }
}

export const createVideoWithConfig = async (prompt: string, config: VideoConfig) => {
    const videoId = randomUUID()
    const user = await currentUser()
    const userId = user?.id

    if (!userId) {
        return null
    }

    // Calculate credits needed based on configuration
    let creditsNeeded = 1
    if (config.duration === '60') creditsNeeded += 1
    if (config.imageCount > 5) creditsNeeded += Math.ceil((config.imageCount - 5) * 0.2)

    // Store the video with configuration
    await prisma.video.create({
        data: {
            videoId,
            userId,
            prompt,
            processing: true,
            // Store config as JSON in a text field for now, can be expanded later
            description: JSON.stringify(config)
        }
    })

    // Decrease credits based on configuration
    for (let i = 0; i < creditsNeeded; i++) {
        await decreaseCredits(userId)
    }

    await videoQueue.add('generate-video', { videoId, config })
    console.log('job added to queue successfully with config:', config)

    return { videoId }
}
