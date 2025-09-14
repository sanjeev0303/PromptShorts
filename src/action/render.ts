import { prisma } from "@/lib/prisma";
import {
  getRenderProgress,
  renderMediaOnLambda,
} from "@remotion/lambda/client";

export const renderVideo = async (videoId: string) => {
  try {
    const data = await prisma.video.findUnique({
      where: {
        videoId: videoId,
      },
    });
    if (!data) {
      return undefined;
    }

    // Check if mock rendering is enabled via environment variable
    const useMockRendering = process.env.USE_MOCK_RENDERING === 'true';

    console.log(`🔧 Environment check: USE_MOCK_RENDERING=${process.env.USE_MOCK_RENDERING}, useMockRendering=${useMockRendering}`);

    if (useMockRendering) {
      console.log("🎬 Mock rendering enabled: Using mock video rendering...");

      // Simulate rendering delay
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Create a mock video URL (in production, this would be the actual rendered video)
      const mockVideoUrl = `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4`;

      console.log(`🎬 Mock video URL generated: ${mockVideoUrl}`);

      await prisma.video.update({
        where: {
          videoId: videoId,
        },
        data: {
          videoUrl: mockVideoUrl,
          processing: false,
        },
      });

      return mockVideoUrl;
    }

    // Production rendering with Remotion Lambda
    console.log("🎬 Starting real video rendering with Remotion Lambda...");
    console.log(`🎨 Images: ${data.imageLinks?.length || 0} files`);
    console.log(`🎵 Audio: ${data.audio ? 'Available' : 'Missing'}`);
    console.log(`💬 Captions: ${Array.isArray(data.captions) ? data.captions.length : 0} words`);
    console.log(`⏱️ Duration: ${data.duration} frames`);

    const { bucketName, renderId } = await renderMediaOnLambda({
      region: "ap-south-1",
      functionName: "remotion-render-4-0-347-mem2048mb-disk2048mb-120sec",
      composition: "MyVideo",
      serveUrl:
        "https://remotionlambda-apsouth1-pd2s5nkcew.s3.ap-south-1.amazonaws.com/sites/remotion-render-4-0-347-mem2048mb-disk2048mb-120sec/index.html",
      codec: "h264",
      inputProps: {
        imageLinks: data.imageLinks,
        audio: data.audio,
        captions: data.captions,
        durationInFrames: data.duration,
      },
      framesPerLambda: 400,
    });

    console.log(`🚀 Render started! Bucket: ${bucketName}, RenderID: ${renderId}`);

    while (true) {
      const progress = await getRenderProgress({
        region: "ap-south-1",
        functionName: "remotion-render-4-0-347-mem2048mb-disk2048mb-120sec",
        renderId,
        bucketName,
      });

      if (progress.fatalErrorEncountered) {
        console.error("❌ Render failed:", progress.errors);
        throw new Error(`Remotion render failed: ${progress.errors}`);
      }

      if (progress.done) {
        const videoUrl =
          progress.outputFile ||
          `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${renderId}/out.mp4`;

        console.log(`✅ Render complete! Video URL: ${videoUrl}`);

        await prisma.video.update({
          where: {
            videoId: videoId,
          },
          data: {
            videoUrl: videoUrl,
            processing: false,
          },
        });

        return videoUrl;
      }

      const framesRendered = progress.framesRendered || 0;
      const percent = Math.floor(progress.overallProgress * 100);

      console.log(`🎬 Render progress: ${percent}% (${framesRendered} frames rendered)`);

      // Wait a bit before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } catch (error) {
    console.error("error while generating video in remotion", error);
    throw error;
  }
};
