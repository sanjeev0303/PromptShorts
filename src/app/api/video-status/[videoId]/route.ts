
import { prisma } from "@/lib/prisma"
import { NextResponse } from "next/server"

export async function GET(
    request: Request,
    { params }: {
        params: Promise<{ videoId: string }>
    }
) {
    try {
        const { videoId } = await params;

        console.log("🔍 Checking video status for ID:", videoId);

        const video = await prisma.video.findUnique({
            where: {
                videoId: videoId
            },
            select: {
                processing: true,
                failed: true,
                videoUrl: true,
                content: true,
                createdAt: true
            }
        })

        if (!video) {
            console.log("❌ Video not found:", videoId);
            return NextResponse.json({ error: 'video not found' }, { status: 404 })
        }

        console.log("✅ Video found:", {
            videoId,
            processing: video.processing,
            failed: video.failed,
            hasVideoUrl: !!video.videoUrl,
            hasContent: !!video.content
        });

        return NextResponse.json({
            completed: !video.processing && !!video.videoUrl && !video.failed,
            failed: video.failed,
            processing: video.processing,
            videoUrl: video.videoUrl,
            content: video.content
        })

    } catch (error) {
        console.error("❌ Error in video-status API:", error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        )
    }
}
