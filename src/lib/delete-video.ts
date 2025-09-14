"use server"

import { auth, currentUser } from "@clerk/nextjs/server"
import { prisma } from "./prisma"



export async function deleteVideo(videoId: string) {
    try {
        const user = await currentUser()
        if (!user) {
            return null
        }

        const userId = user?.id

        await prisma.video.delete({
            where: {
                videoId: videoId,
                userId: userId
            }
        })
    } catch (error) {
        return { success: false, error: "Failed to delete video" }
    }
}
