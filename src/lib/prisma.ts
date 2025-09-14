import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient({
    log: ['warn', 'error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
})

if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma
}

// Ensure connection on startup
prisma.$connect().then(() => {
    console.log('✅ Prisma connected successfully')
}).catch((error) => {
    console.error('❌ Prisma connection failed:', error)
})
