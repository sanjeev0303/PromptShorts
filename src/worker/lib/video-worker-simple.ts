import { Worker, Job } from "bullmq"
import { createRedisConnection } from "@/lib/simple-queue"
import { prisma } from "@/lib/prisma"

/**
 * Standalone video processing worker
 * Optimized for production use with minimal overhead
 */
export class VideoProcessingWorker {
    private worker: Worker
    private cleanupInterval?: NodeJS.Timeout

    constructor() {
        console.log("🎬 Initializing Video Processing Worker...")

        this.worker = new Worker('video-processing', this.processJob.bind(this), {
            connection: createRedisConnection(),
            concurrency: process.env.NODE_ENV === 'production' ? 4 : 2
        })

        this.setupEventHandlers()
        this.startCleanupSchedule()
    }

    private async processJob(job: Job) {
        const { videoId, config } = job.data
        const startTime = Date.now()

        try {
            console.log(`📹 Processing video job: ${videoId}`)
            await job.updateProgress(0)

            // Import processing functions
            const { processes } = await import('@/action/processes')
            const { processesWithConfig } = await import('@/action/processes-with-config')

            // Process video with appropriate function
            const result = config
                ? await processesWithConfig(videoId, config)
                : await processes(videoId)

            await job.updateProgress(100)

            const duration = Date.now() - startTime
            console.log(`✅ Video ${videoId} processed successfully in ${duration}ms`)

            return result

        } catch (error) {
            console.error(`❌ Video ${videoId} processing failed:`, error)

            // Mark video as failed in database
            await prisma.video.update({
                where: { videoId },
                data: { processing: false, failed: true }
            }).catch(dbError => {
                console.error("Failed to update video status:", dbError)
            })

            throw error
        }
    }

    private setupEventHandlers() {
        this.worker.on('completed', (job, result) => {
            const duration = Date.now() - job.timestamp
            console.log(`✅ Job ${job.id} completed in ${duration}ms`)
        })

        this.worker.on('failed', (job, err) => {
            if (job) {
                const duration = Date.now() - job.timestamp
                console.error(`❌ Job ${job.id} failed after ${duration}ms:`, err.message)
            }
        })

        this.worker.on('error', (err) => {
            console.error('❌ Worker error:', err.message)
        })
    }

    private startCleanupSchedule() {
        if (process.env.NODE_ENV === 'production') {
            // Clean stuck jobs every 30 minutes in production
            this.cleanupInterval = setInterval(this.cleanupStuckJobs.bind(this), 30 * 60 * 1000)
        }
    }

    private async cleanupStuckJobs() {
        try {
            console.log("🧹 Cleaning stuck jobs...")

            // Find videos stuck in processing for more than 30 minutes
            const stuckVideos = await prisma.video.findMany({
                where: {
                    processing: true,
                    createdAt: {
                        lt: new Date(Date.now() - 30 * 60 * 1000)
                    }
                }
            })

            // Mark them as failed
            for (const video of stuckVideos) {
                await prisma.video.update({
                    where: { videoId: video.videoId },
                    data: { processing: false, failed: true }
                })
                console.log(`Cleaned stuck video: ${video.videoId}`)
            }

            console.log(`✅ Cleanup completed. Fixed ${stuckVideos.length} stuck videos`)
        } catch (error) {
            console.error("❌ Cleanup error:", error)
        }
    }

    public async shutdown() {
        console.log("🛑 Shutting down video worker...")

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval)
        }

        await this.worker.close()
        console.log("✅ Worker shutdown complete")
    }
}
