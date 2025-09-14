import { prisma } from "@/lib/prisma"
import { AssemblyAI } from "assemblyai"
import { performanceMonitor } from "@/lib/monitoring"



const apiKey = process.env.ASSEMBLY_API_KEY
if (!apiKey) {
    throw new Error("missing assembly api key")
}

const client = new AssemblyAI({
    apiKey: apiKey
})


export const generateCaptions = async (videoId: string) => {
    return performanceMonitor.timeOperation(
        `generate_captions`,
        async () => {
            const maxRetries = 3;
            let attempt = 0;

            while (attempt < maxRetries) {
                try {
                    attempt++;
                    performanceMonitor.recordMetric('captions.attempt', 1, { videoId }, 'count');

                    const video = await prisma.video.findUnique({
                        where: { videoId: videoId }
                    })

                    if (!video || !video.audio) {
                        console.warn(`Video ${videoId} not found or has no audio`);
                        performanceMonitor.recordMetric('captions.no_audio', 1, { videoId }, 'count');
                        return undefined
                    }

                    console.log(`🎯 Generating captions for video ${videoId} (attempt ${attempt}/${maxRetries})...`);

                    // Add timeout to the fetch operation
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

                    try {
                        const transcript = await client.transcripts.transcribe({
                            audio_url: video.audio,
                            // word_boost: ['AI', 'technology', 'business', 'innovation', 'digital', 'startup'],
                            punctuate: true,
                            filter_profanity: true
                        });

                        clearTimeout(timeoutId);

                        if (!transcript.words || transcript.words.length === 0) {
                            console.warn(`No transcript words generated for video ${videoId}`);
                            performanceMonitor.recordMetric('captions.no_words', 1, { videoId }, 'count');
                            return undefined;
                        }

                        const captions = transcript.words.map(word => ({
                            text: word.text,
                            startFrame: Math.round(word.start / 1000 * 30), // Convert to 30fps frames
                            endFrame: Math.round(word.end / 1000 * 30)
                        }));

                        console.log(`✅ Generated ${captions.length} caption words for video ${videoId}`);
                        performanceMonitor.recordMetric('captions.words_generated', captions.length, { videoId }, 'count');

                        await prisma.video.update({
                            where: {
                                videoId: videoId
                            },
                            data: {
                                captions: captions
                            }
                        })

                        performanceMonitor.recordMetric('captions.success', 1, { videoId }, 'count');
                        console.log(`✅ Captions saved successfully for video ${videoId}`);
                        return captions;

                    } catch (transcriptError) {
                        clearTimeout(timeoutId);
                        throw transcriptError;
                    }

                } catch (error: any) {
                    console.error(`❌ Error generating captions for video ${videoId} (attempt ${attempt}):`, error);

                    // Check if it's a network error that might be retryable
                    const isRetryableError = error.code === 'ENETUNREACH' ||
                                           error.code === 'EAI_AGAIN' ||
                                           error.code === 'ECONNREFUSED' ||
                                           error.message?.includes('fetch failed');

                    if (attempt === maxRetries || !isRetryableError) {
                        performanceMonitor.recordMetric('captions.error', 1, {
                            videoId,
                            error: error instanceof Error ? error.message : 'Unknown error',
                            attempts: attempt.toString()
                        }, 'count');
                        throw error;
                    }

                    // Wait before retrying with exponential backoff
                    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
                    console.log(`⏳ Retrying captions generation in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }

            // This should never be reached, but just in case
            throw new Error(`Failed to generate captions after ${maxRetries} attempts`);
        },
        { videoId }
    );
}
