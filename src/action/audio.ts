import { prisma } from "@/lib/prisma"
import { ElevenLabsClient } from "elevenlabs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { performanceMonitor } from "@/lib/monitoring";

// FIX: Corrected API key environment variable name
const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

const s3Client = new S3Client({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    }
})

const bucketName = process.env.S3_BUCKET_NAME

export const generateAudio = async (videoId: string) => {
    return performanceMonitor.timeOperation(
        'audio.generate',
        async () => {
            try {
                const video = await prisma.video.findUnique({
                    where: { videoId: videoId }
                })
                if (!video || !video.content) {
                    throw new Error(`No video or content found for videoId: ${videoId}`);
                }

                console.log(`🎵 Generating audio for video ${videoId}, content length: ${video.content.length} chars`);

                // Time the ElevenLabs API call
                const audioStream = await performanceMonitor.timeOperation(
                    'audio.elevenlabs.generate',
                    async () => {
                        return await client.textToSpeech.convertAsStream("JBFqnCBsd6RMkjVDRZzb",
                            {
                                text: video.content!,
                                model_id: "eleven_multilingual_v2",
                                output_format: "mp3_44100_128",
                            }
                        );
                    },
                    { videoId, contentLength: video.content.length.toString() }
                );

                // Time the audio stream processing
                const audioBuffer = await performanceMonitor.timeOperation(
                    'audio.stream.process',
                    async () => {
                        const chunks: Buffer[] = []
                        for await (const chunk of audioStream) {
                            chunks.push(chunk)
                        }
                        return Buffer.concat(chunks);
                    },
                    { videoId }
                );

                const fileName = `${randomUUID()}.mp3`

                const command = new PutObjectCommand({
                    Bucket: bucketName,
                    Key: fileName,
                    Body: audioBuffer,
                    ContentType: "audio/mpeg"
                })

                // Time the S3 upload
                await performanceMonitor.timeOperation(
                    'audio.upload.s3',
                    async () => {
                        await s3Client.send(command);
                    },
                    { videoId, audioSize: audioBuffer.length.toString() }
                );

                const s3Url = `https://${bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${fileName}`
                console.log("✅ Audio uploaded to S3:", s3Url)

                await prisma.video.update({
                    where: {
                        videoId: videoId
                    },
                    data: {
                        audio: s3Url
                    }
                })

                performanceMonitor.recordMetric('audio.generate.success', 1,
                    { videoId, audioSize: audioBuffer.length.toString() }, 'count');

                return s3Url
            }
            catch (error) {
                performanceMonitor.recordMetric('audio.generate.error', 1,
                    { videoId }, 'count');

                console.error('❌ Error while generating audio:', error)

                // Update video status to failed
                await prisma.video.update({
                    where: { videoId: videoId },
                    data: { failed: true, processing: false }
                });

                throw error
            }
        },
        { videoId }
    );
}
