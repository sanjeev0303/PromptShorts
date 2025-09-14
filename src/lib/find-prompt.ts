'use server'

import { prisma } from "./prisma"


export const findPrompt = async (videoId: string) => {
    const data = await prisma.video.findUnique({
        where: {
            videoId: videoId
        }
    })

    return data?.prompt
}
