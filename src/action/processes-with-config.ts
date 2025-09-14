"use server"

import { generateScriptWithConfig } from "@/action/script-with-config"
import { generateImages } from "@/action/image"
import { generateAudio } from "@/action/audio"
import { generateCaptions } from "@/action/captions"
import { videoDuration } from "@/lib/duration"
import { renderVideo } from "@/action/render"
import { prisma } from "@/lib/prisma"
import { performanceMonitor } from "@/lib/monitoring"

interface VideoConfig {
    duration: '15' | '30' | '60'
    imageCount: 3 | 4 | 5 | 6 | 8
    aspectRatio: '9:16' | '16:9' | '1:1'
}

class VideoProcessingError extends Error {
    constructor(
        message: string,
        public readonly step: string,
        public readonly videoId: string,
        public readonly originalError?: Error
    ) {
        super(message)
        this.name = 'VideoProcessingError'
    }
}

interface ProcessingState {
    currentStep: string
    steps: Array<{
        name: string
        status: 'pending' | 'running' | 'completed' | 'failed'
        startTime?: Date
        endTime?: Date
        error?: string
    }>
}

export const processesWithConfig = async (videoId: string, config: VideoConfig) => {
    const overallStartTime = Date.now()
    const stepDurations: Record<string, number> = {}
    const errors: string[] = []
    let retryCount = 0

    console.log(`🎬 Starting video processing with config:`, { videoId, config })

    // Initialize processing state
    const processingState: ProcessingState = {
        currentStep: 'initializing',
        steps: [
            { name: 'generate_script', status: 'pending' },
            { name: 'generate_images', status: 'pending' },
            { name: 'generate_audio', status: 'pending' },
            { name: 'generate_captions', status: 'pending' },
            { name: 'calculate_duration', status: 'pending' },
            { name: 'render_video', status: 'pending' }
        ]
    }

    const executeStep = async <T>(
        processingState: ProcessingState,
        stepName: string,
        stepFunction: () => Promise<T>
    ): Promise<T> => {
        const stepIndex = processingState.steps.findIndex(step => step.name === stepName)
        if (stepIndex >= 0) {
            processingState.steps[stepIndex].status = 'running'
            processingState.steps[stepIndex].startTime = new Date()
        }

        processingState.currentStep = stepName
        const stepStartTime = Date.now()

        try {
            const result = await stepFunction()

            const stepEndTime = Date.now()
            stepDurations[stepName] = stepEndTime - stepStartTime

            if (stepIndex >= 0) {
                processingState.steps[stepIndex].status = 'completed'
                processingState.steps[stepIndex].endTime = new Date()
            }

            return result
        } catch (error) {
            const stepEndTime = Date.now()
            stepDurations[stepName] = stepEndTime - stepStartTime

            if (stepIndex >= 0) {
                processingState.steps[stepIndex].status = 'failed'
                processingState.steps[stepIndex].endTime = new Date()
                processingState.steps[stepIndex].error = error instanceof Error ? error.message : 'Unknown error'
            }

            throw new VideoProcessingError(
                error instanceof Error ? error.message : 'Unknown error occurred',
                stepName,
                videoId,
                error instanceof Error ? error : undefined
            )
        }
    }

    try {
        // Step 1: Generate script with config
        await executeStep(processingState, 'generate_script', async () => {
            return performanceMonitor.timeOperation(
                'generate_script_with_config',
                async () => {
                    console.log(`📝 Generating ${config.duration}s script with ${config.imageCount} images...`)
                    await generateScriptWithConfig(videoId, config)
                    console.log("✅ Script generated with config")
                },
                { videoId, config: JSON.stringify(config) }
            )
        })

        // Step 2: Generate images with config
        await executeStep(processingState, 'generate_images', async () => {
            return performanceMonitor.timeOperation(
                'generate_images_with_config',
                async () => {
                    console.log(`🎨 Generating ${config.imageCount} images for ${config.aspectRatio}...`)
                    await generateImages(videoId)
                    console.log("✅ Images generated with config")
                },
                { videoId, config: JSON.stringify(config) }
            )
        })

        // Step 3: Generate audio (same as before)
        await executeStep(processingState, 'generate_audio', async () => {
            return performanceMonitor.timeOperation(
                'generate_audio',
                async () => {
                    console.log("🎵 Generating audio...")
                    await generateAudio(videoId)
                    console.log("✅ Audio generated")
                },
                { videoId }
            )
        })

        // Step 4: Generate captions (same as before)
        await executeStep(processingState, 'generate_captions', async () => {
            return performanceMonitor.timeOperation(
                'generate_captions',
                async () => {
                    console.log("📝 Generating captions...")
                    await generateCaptions(videoId)
                    console.log("✅ Captions generated")
                },
                { videoId }
            )
        })

        // Step 5: Calculate duration (same as before)
        await executeStep(processingState, 'calculate_duration', async () => {
            return performanceMonitor.timeOperation(
                'calculate_duration',
                async () => {
                    console.log("⏱️ Calculating video duration...")
                    await videoDuration(videoId)
                    console.log("✅ Duration calculated")
                },
                { videoId }
            )
        })

        // Step 6: Render video with config
        const videoUrl = await executeStep(processingState, 'render_video', async () => {
            return performanceMonitor.timeOperation(
                'render_video_with_config',
                async () => {
                    console.log(`🎬 Rendering ${config.duration}s video in ${config.aspectRatio}...`)
                    const url = await renderVideo(videoId)
                    if (!url) {
                        throw new Error("Video rendering failed - no URL returned")
                    }
                    return url
                },
                { videoId, config: JSON.stringify(config) }
            )
        })

        const totalTime = Date.now() - overallStartTime
        console.log(`✅ Video processing complete! Time: ${totalTime}ms, URL: ${videoUrl}`)

        // Record successful processing metrics
        performanceMonitor.recordVideoProcessingMetrics({
            videoId,
            totalDuration: totalTime,
            stepDurations,
            errors,
            retryCount,
            memoryUsage: process.memoryUsage().heapUsed,
            status: 'success'
        })

        return videoUrl

    } catch (error) {
        const totalTime = Date.now() - overallStartTime

        const processingError = error instanceof VideoProcessingError
            ? error
            : new VideoProcessingError(
                error instanceof Error ? error.message : 'Unknown error',
                processingState.currentStep || 'unknown',
                videoId,
                error instanceof Error ? error : undefined
            )

        errors.push(processingError.message)

        console.error('❌ Error in video processing with config:', {
            videoId: processingError.videoId,
            step: processingError.step,
            message: processingError.message,
            config,
            originalError: processingError.originalError?.message
        })

        // Record failed processing metrics
        performanceMonitor.recordVideoProcessingMetrics({
            videoId,
            totalDuration: totalTime,
            stepDurations,
            errors,
            retryCount,
            memoryUsage: process.memoryUsage().heapUsed,
            status: 'failed'
        })

        // Update processing state in steps array
        const failedStepIndex = processingState.steps.findIndex(
            step => step.name === processingError.step
        )
        if (failedStepIndex >= 0) {
            processingState.steps[failedStepIndex].status = 'failed'
            processingState.steps[failedStepIndex].error = processingError.message
        }

        // Mark video as failed in database
        await prisma.video.update({
            where: { videoId },
            data: {
                processing: false,
                failed: true,
                failureReason: processingError.message,
                lastProcessingStep: processingError.step
            }
        }).catch(dbError => {
            console.error("Failed to update video status in database:", dbError)
        })

        throw processingError
    }
}
