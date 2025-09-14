"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@clerk/nextjs/server"

export const userCredit = async () => {
    try {
        const { userId } = await auth()

        if (!userId) {
            return 0
        }

        const data = await prisma.user.findUnique({
            where: {
                userId: userId
            }
        })

        return data?.credits ?? 0
    } catch (error) {
        console.error("Error getting user credits:", error)
        return 0
    }
}
