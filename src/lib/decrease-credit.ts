import { prisma } from "./prisma"

export const decreaseCredits = async (userId: string) => {
    try {
        await prisma.user.update({
            where: {
                userId: userId
            },
            data: {
                credits: {
                    decrement: 1
                }
            }
        })
    } catch (error) {
        console.error("Error decreasing credits:", error)
        throw error
    }
}
