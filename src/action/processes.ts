import { findPrompt } from "@/lib/find-prompt"
import { generateScript } from "./script"
import { prisma } from "@/lib/prisma"
import { generateImages } from "./image"
import { generateAudio } from "./audio"
import { generateCaptions } from "./captions"
import { videoDuration } from "@/lib/duration"
import { renderVideo } from "./render"
import { performanceMonitor } from "@/lib/monitoring"

interface ProcessingStep {
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: Date;
    endTime?: Date;
    error?: string;
}

interface ProcessingState {
    videoId: string;
    steps: ProcessingStep[];
    startTime: Date;
    currentStep?: string;
}

class VideoProcessingError extends Error {
    constructor(
        message: string,
        public step: string,
        public videoId: string,
        public originalError?: Error
    ) {
        super(message);
        this.name = 'VideoProcessingError';
    }
}

export const processes = async (videoId: string) => {
    const overallStartTime = Date.now();
    const stepDurations: Record<string, number> = {};
    const retryCount = 0;
    const errors: string[] = [];

    const processingState: ProcessingState = {
        videoId,
        startTime: new Date(),
        steps: [
            { name: 'retrieve_prompt', status: 'pending' },
            { name: 'generate_script', status: 'pending' },
            { name: 'parse_script', status: 'pending' },
            { name: 'generate_images', status: 'pending' },
            { name: 'generate_audio', status: 'pending' },
            { name: 'generate_captions', status: 'pending' },
            { name: 'calculate_duration', status: 'pending' },
            { name: 'render_video', status: 'pending' }
        ]
    };

    console.log(`🚀 Starting video processing for ID: ${videoId}`);
    performanceMonitor.recordMetric('video.processing.started', 1, { videoId }, 'count');

    try {
        // Step 1: Get prompt with performance tracking
        const prompt = await performanceMonitor.timeOperation(
            'retrieve_prompt',
            async () => {
                const prompt = await findPrompt(videoId);
                if (!prompt) {
                    throw new Error("No prompt found for video");
                }
                console.log("📝 Prompt retrieved:", prompt.substring(0, 100) + "...");
                return prompt;
            },
            { videoId }
        );

        // Step 2: Generate script with retries and monitoring
        const script = await executeStepWithRetry(
            processingState,
            'generate_script',
            async () => {
                return performanceMonitor.timeOperation(
                    'generate_script',
                    async () => {
                        console.log("🤖 Generating script with enhanced AI prompt...");
                        const result = await generateScript(prompt);
                        if (!result) {
                            throw new Error("Failed to generate script from AI");
                        }
                        console.log("✅ Script generated:", result.substring(0, 200) + "...");
                        return result;
                    },
                    { videoId }
                );
            },
            3 // max retries
        );

        // Step 3: Parse and validate script
        const { contentTexts, imagePrompts, fullContent } = await executeStep(
            processingState,
            'parse_script',
            async () => {
                return performanceMonitor.timeOperation(
                    'parse_script',
                    async () => {
                        let scriptData;
                        try {
                            scriptData = JSON.parse(script);
                        } catch (parseError) {
                            throw new Error("Invalid JSON format from AI script generation");
                        }

                        if (!scriptData.content || !Array.isArray(scriptData.content)) {
                            throw new Error("Invalid script structure: missing content array");
                        }

                        if (scriptData.content.length !== 5) {
                            throw new Error(`Expected 5 scenes, got ${scriptData.content.length}`);
                        }

                        const contentTexts = scriptData.content.map((data: { contentText: string }) => data.contentText);
                        const imagePrompts = scriptData.content.map((data: { imagePrompt: string }) => data.imagePrompt);
                        const fullContent = contentTexts.join(" ");

                        // Validate all required fields are present
                        for (let i = 0; i < scriptData.content.length; i++) {
                            const scene = scriptData.content[i];
                            if (!scene.contentText || !scene.imagePrompt) {
                                throw new Error(`Scene ${i + 1} missing required fields`);
                            }
                        }

                        console.log("📊 Processing data:");
                        console.log(`- Full content: ${fullContent.length} characters`);
                        console.log(`- Scenes: ${contentTexts.length}`);
                        console.log(`- Image prompts: ${imagePrompts.length}`);

                        return { contentTexts, imagePrompts, fullContent };
                    },
                    { videoId }
                );
            }
        );

        // Step 4: Update database with parsed data (with timeout handling)
        await performanceMonitor.timeOperation(
            'database.update.parsed_data',
            async () => {
                const timeoutPromise = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Database operation timeout')), 30000)
                );

                const updatePromise = prisma.video.update({
                    where: { videoId },
                    data: {
                        content: fullContent,
                        imagePrompts: imagePrompts
                    }
                });

                return Promise.race([updatePromise, timeoutPromise]);
            },
            { videoId }
        );

        // Step 5: Generate images (with retry mechanism)
        await executeStepWithRetry(
            processingState,
            'generate_images',
            async () => {
                return performanceMonitor.timeOperation(
                    'generate_images',
                    async () => {
                        console.log("🎨 Starting image generation...");
                        await generateImages(videoId);
                        console.log("✅ Images generated successfully");
                    },
                    { videoId }
                );
            },
            2
        );

        // Step 6: Generate audio
        await executeStepWithRetry(
            processingState,
            'generate_audio',
            async () => {
                return performanceMonitor.timeOperation(
                    'generate_audio',
                    async () => {
                        console.log("🎵 Generating audio...");
                        await generateAudio(videoId);
                        console.log("✅ Audio generated successfully");
                    },
                    { videoId }
                );
            },
            2
        );

        // Step 7: Generate captions
        await executeStep(processingState, 'generate_captions', async () => {
            return performanceMonitor.timeOperation(
                'generate_captions',
                async () => {
                    console.log("📝 Generating captions...");
                    await generateCaptions(videoId);
                    console.log("✅ Captions generated successfully");
                },
                { videoId }
            );
        });

        // Step 8: Calculate duration
        await executeStep(processingState, 'calculate_duration', async () => {
            return performanceMonitor.timeOperation(
                'calculate_duration',
                async () => {
                    console.log("⏱️ Calculating video duration...");
                    await videoDuration(videoId);
                    console.log("✅ Duration calculated");
                },
                { videoId }
            );
        });

        // Step 9: Render video
        const videoUrl = await executeStep(processingState, 'render_video', async () => {
            return performanceMonitor.timeOperation(
                'render_video',
                async () => {
                    console.log("🎬 Starting video render...");
                    const url = await renderVideo(videoId);
                    if (!url) {
                        throw new Error("Video rendering failed - no URL returned");
                    }
                    return url;
                },
                { videoId }
            );
        });

        const totalTime = Date.now() - overallStartTime;
        console.log(`✅ Video processing complete! Time: ${totalTime}ms, URL: ${videoUrl}`);

        // Record successful processing metrics
        performanceMonitor.recordVideoProcessingMetrics({
            videoId,
            totalDuration: totalTime,
            stepDurations,
            errors,
            retryCount,
            memoryUsage: process.memoryUsage().heapUsed,
            status: 'success'
        });

        return videoUrl;

    } catch (error) {
        const totalTime = Date.now() - overallStartTime;

        const processingError = error instanceof VideoProcessingError
            ? error
            : new VideoProcessingError(
                error instanceof Error ? error.message : 'Unknown error',
                processingState.currentStep || 'unknown',
                videoId,
                error instanceof Error ? error : undefined
            );

        errors.push(processingError.message);

        console.error('❌ Error in video processing:', {
            videoId: processingError.videoId,
            step: processingError.step,
            message: processingError.message,
            originalError: processingError.originalError?.message
        });

        // Record failed processing metrics
        performanceMonitor.recordVideoProcessingMetrics({
            videoId,
            totalDuration: totalTime,
            stepDurations,
            errors,
            retryCount,
            memoryUsage: process.memoryUsage().heapUsed,
            status: 'failed'
        });

        // Update processing state in steps array
        const failedStepIndex = processingState.steps.findIndex(
            step => step.name === processingError.step
        );
        if (failedStepIndex >= 0) {
            processingState.steps[failedStepIndex].status = 'failed';
            processingState.steps[failedStepIndex].error = processingError.message;
            processingState.steps[failedStepIndex].endTime = new Date();
        }

        // Mark video as failed in database with detailed error info (with timeout protection)
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Database update timeout')), 15000)
            );

            const updatePromise = prisma.video.update({
                where: { videoId },
                data: {
                    failed: true,
                    processing: false,
                }
            });

            await Promise.race([updatePromise, timeoutPromise]);
        } catch (dbError) {
            console.error(`Failed to update video failure status in database:`, dbError);
            // Don't throw here - we still want to report the original error
        }

        throw processingError;
    }
}

async function executeStep<T>(
    state: ProcessingState,
    stepName: string,
    operation: () => Promise<T>
): Promise<T> {
    const stepStartTime = Date.now();
    const step = state.steps.find(s => s.name === stepName);
    if (!step) {
        throw new VideoProcessingError(`Unknown step: ${stepName}`, stepName, state.videoId);
    }

    step.status = 'running';
    step.startTime = new Date();
    state.currentStep = stepName;

    try {
        const result = await operation();
        step.status = 'completed';
        step.endTime = new Date();

        const stepDuration = Date.now() - stepStartTime;
        performanceMonitor.recordMetric(`video.step.${stepName}.duration`, stepDuration,
            { videoId: state.videoId }, 'ms');

        return result;
    } catch (error) {
        step.status = 'failed';
        step.endTime = new Date();
        step.error = error instanceof Error ? error.message : 'Unknown error';

        const stepDuration = Date.now() - stepStartTime;
        performanceMonitor.recordMetric(`video.step.${stepName}.duration`, stepDuration,
            { videoId: state.videoId }, 'ms');
        performanceMonitor.recordMetric(`video.step.${stepName}.error`, 1,
            { videoId: state.videoId }, 'count');

        throw new VideoProcessingError(
            error instanceof Error ? error.message : 'Unknown error',
            stepName,
            state.videoId,
            error instanceof Error ? error : undefined
        );
    }
}

async function executeStepWithRetry<T>(
    state: ProcessingState,
    stepName: string,
    operation: () => Promise<T>,
    maxRetries: number = 2
): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            console.log(`🔄 Attempting ${stepName} (attempt ${attempt}/${maxRetries + 1})`);
            performanceMonitor.recordMetric(`video.step.${stepName}.attempt`, attempt,
                { videoId: state.videoId }, 'count');

            return await executeStep(state, stepName, operation);
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');

            if (attempt <= maxRetries) {
                const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Exponential backoff, max 10s
                console.log(`⏳ Retrying ${stepName} in ${delay}ms...`);

                performanceMonitor.recordMetric(`video.step.${stepName}.retry`, 1,
                    { videoId: state.videoId, attempt: attempt.toString() }, 'count');

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError;
}
