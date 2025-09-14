"use server"

import { performanceMonitor } from "@/lib/monitoring";
import { prisma } from "@/lib/prisma";
import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
})

interface Scene {
    imagePrompt: string;
    contentText: string;
}

interface ScriptResponse {
    content: Scene[];
    title: string;
}

interface VideoConfig {
    duration: '15' | '30' | '60'
    imageCount: 3 | 4 | 5 | 6 | 8
    aspectRatio: '9:16' | '16:9' | '1:1'
}

const getScriptPromptForConfig = (prompt: string, config: VideoConfig) => {
    const sceneCounts = {
        '15': 3,
        '30': 5,
        '60': 8
    }

    const sceneDurations = {
        '15': 5,
        '30': 6,
        '60': 7.5
    }

    const sceneCount = sceneCounts[config.duration]
    const sceneDuration = sceneDurations[config.duration]
    const totalWords = sceneCount * 15 // Approximate words per scene
    const minWords = Math.max(totalWords - 10, sceneCount * 12)
    const maxWords = totalWords + 15

    const aspectRatioDescriptions = {
        '9:16': 'vertical smartphone format with portrait orientation',
        '16:9': 'horizontal widescreen format with landscape orientation',
        '1:1': 'square format perfect for social media posts'
    }

    return `Generate a structured JSON script that precisely defines a ${config.duration}-second video with ${sceneCount} scenes optimized for ${aspectRatioDescriptions[config.aspectRatio]}, where each scene contains:

**CRITICAL REQUIREMENTS:**
- **Video Duration**: ${config.duration} seconds total
- **Scene Count**: Exactly ${sceneCount} scenes
- **Scene Distribution**: ${sceneCount} scenes × ${sceneDuration} seconds each
- **Images**: ${config.imageCount} total images distributed across scenes
- **Format**: ${config.aspectRatio} aspect ratio (${aspectRatioDescriptions[config.aspectRatio]})

**JSON Structure:**
{
  "content": [
    {
      "imagePrompt": "string - EXACTLY 20-35 words, photorealistic description optimized for ${config.aspectRatio}",
      "contentText": "string - EXACTLY 12-22 words, natural narration"
    }
  ],
  "title": "string - Engaging title for the video"
}

**Image Prompt Requirements (${config.aspectRatio} optimized):**
Each imagePrompt must be EXACTLY 20-35 words and must:
- Be optimized for ${config.aspectRatio} composition
- ${config.aspectRatio === '9:16' ? 'Focus on vertical compositions, close-ups, and portrait shots' : ''}
- ${config.aspectRatio === '16:9' ? 'Focus on wide landscapes, cinematic shots, and horizontal compositions' : ''}
- ${config.aspectRatio === '1:1' ? 'Focus on centered compositions, balanced layouts, and square framing' : ''}
- Include lighting details (golden hour, studio, natural, dramatic)
- Specify camera angle (wide shot, close-up, medium, aerial, etc.)
- Be self-contained (no references to other scenes)
- Use photorealistic, professional photography terminology
- Create visual diversity across scenes:
  - Avoid reusing the same setting, lighting, or angle across multiple scenes
  - Mix different environments, times of day, and visual styles
  - Vary between close-ups, wide shots, and medium shots

**Content Text Requirements:**
Each contentText must be EXACTLY 12-22 words and must:
- Sound natural when spoken aloud
- Be engaging and hook the viewer
- Flow smoothly from one scene to the next
- Avoid repetitive phrasing or words
- Build a coherent narrative arc across all ${sceneCount} scenes

**Image Distribution Strategy:**
- Total images: ${config.imageCount}
- Distribute images across ${sceneCount} scenes
- Some scenes may have multiple images for variety
- ${config.imageCount > sceneCount ? `Use ${config.imageCount - sceneCount} extra images for scene transitions or emphasis` : ''}

**Topic:** ${prompt}

**Validation Requirements:**
- Exactly ${sceneCount} scenes present
- Total word count: ${minWords}-${maxWords} words (sum of all contentText)
- Each imagePrompt: EXACTLY 20-35 words
- Each contentText: EXACTLY 12-22 words
- Title: Engaging and relevant to the topic
- All scenes should be visually distinct and interesting
- Aspect ratio: Optimized for ${config.aspectRatio}

**Visual Diversity Requirements:**
Do not generate ${sceneCount} similar scenes. Create a visually engaging sequence with:
- Different settings (indoor/outdoor, urban/nature, modern/classic)
- Varied lighting conditions (golden hour, blue hour, studio, natural)
- Multiple camera angles (wide, medium, close-up, aerial)
- Different subjects or focal points
- Diverse color palettes and moods

The sequence should feel like a natural visual progression across different but connected scenes optimized for ${config.aspectRatio} viewing.

**Example for ${config.aspectRatio} format:**
{
  "content": [
    {
      "imagePrompt": "${getExampleImagePrompt(config.aspectRatio)}",
      "contentText": "Have you ever wondered why some entrepreneurs succeed while others struggle?"
    }${sceneCount > 1 ? `,
    {
      "imagePrompt": "${getExampleImagePrompt(config.aspectRatio, 2)}",
      "contentText": "The secret lies in understanding market psychology and timing strategic moves perfectly."
    }` : ''}
  ],
  "title": "${getExampleTitle(prompt)}"
}

Generate the complete JSON response with exactly ${sceneCount} scenes, following all requirements above.`
}

const getExampleImagePrompt = (aspectRatio: string, sceneNumber: number = 1) => {
    const examples = {
        '9:16': [
            "Photorealistic vertical shot of modern entrepreneur working late at sleek glass office with city lights background, professional cinematic lighting, ultra-detailed portrait composition",
            "Ultra-realistic close-up of hands typing on laptop with financial charts displayed on phone screen, golden hour lighting through window, vertical cinematic depth"
        ],
        '16:9': [
            "Photorealistic wide cinematic shot of modern entrepreneur working in sleek glass office with sprawling city skyline, professional dramatic lighting, ultra-detailed horizontal composition",
            "Ultra-realistic wide shot of laptop with financial charts on multiple monitors in modern office, golden hour lighting streaming across desk, cinematic landscape depth"
        ],
        '1:1': [
            "Photorealistic centered shot of modern entrepreneur working at clean desk with laptop, balanced lighting and symmetrical composition, professional square framing, ultra-detailed",
            "Ultra-realistic square composition of hands typing on laptop with financial charts perfectly centered on screen, even lighting, balanced professional photography style"
        ]
    }

    return examples[aspectRatio as keyof typeof examples][Math.min(sceneNumber - 1, 1)]
}

const getExampleTitle = (prompt: string) => {
    // Generate a simple title based on the prompt
    const words = prompt.split(' ').slice(0, 5).join(' ')
    return `${words} - The Complete Guide`
}

export const generateScriptWithConfig = async (videoId: string, config: VideoConfig) => {
    return performanceMonitor.timeOperation(
        'script.generate',
        async () => {
            console.log(`📝 Generating script for ${config.duration}s video with ${config.imageCount} images in ${config.aspectRatio} format`)

            const video = await prisma.video.findUnique({
                where: { videoId },
                select: { prompt: true }
            })

            if (!video?.prompt) {
                throw new Error("Video prompt not found")
            }

            const prompt = getScriptPromptForConfig(video.prompt, config)
            const maxRetries = 4
            const temperatures = [0.1, 0.05, 0.3, 0.01]

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    console.log(`🎬 Script generation attempt ${attempt + 1}/${maxRetries} (temp: ${temperatures[attempt]})`)

                    const completion = await groq.chat.completions.create({
                        messages: [{ role: "user", content: prompt }],
                        model: "openai/gpt-oss-120b",
                        temperature: temperatures[attempt],
                        max_tokens: 8000,
                        response_format: { type: "json_object" }
                    })

                    const content = completion.choices[0]?.message?.content
                    if (!content) {
                        throw new Error("No content received from Groq")
                    }

                    let parsed: ScriptResponse
                    try {
                        parsed = JSON.parse(content)
                    } catch (parseError) {
                        console.log("❌ JSON parsing failed:", parseError)
                        continue
                    }

                    // Enhanced validation for different configurations
                    const validation = validateScriptWithConfig(parsed, config)
                    if (validation.isValid) {
                        console.log("✅ Script generated and validated successfully")

                        // Save the script with configuration
                        await prisma.video.update({
                            where: { videoId },
                            data: {
                                content: parsed.content.map(scene => scene.contentText).join(' '),
                                imagePrompts: parsed.content.map(scene => scene.imagePrompt),
                                title: parsed.title
                            }
                        })

                        performanceMonitor.recordMetric('script.generate.success', 1,
                            { videoId, attempt: attempt.toString(), duration: config.duration }, 'count')

                        return parsed
                    } else {
                        console.log(`❌ Validation failed (attempt ${attempt + 1}):`, validation.errors)

                        if (attempt < maxRetries - 1) {
                            // Try auto-fix for the last 2 attempts
                            if (attempt >= maxRetries - 2) {
                                console.log("🔧 Attempting auto-fix...")
                                const fixedScript = autoFixScriptWithConfig(content, config)
                                const fixedValidation = validateScriptWithConfig(JSON.parse(fixedScript), config)

                                if (fixedValidation.isValid) {
                                    console.log("✅ Auto-fix successful!")
                                    const fixedParsed = JSON.parse(fixedScript)

                                    await prisma.video.update({
                                        where: { videoId },
                                        data: {
                                            content: fixedParsed.content.map((scene: Scene) => scene.contentText).join(' '),
                                            imagePrompts: fixedParsed.content.map((scene: Scene) => scene.imagePrompt),
                                            title: fixedParsed.title
                                        }
                                    })

                                    return fixedParsed
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.log(`❌ Error in script generation attempt ${attempt + 1}:`, error)
                    if (attempt === maxRetries - 1) {
                        throw error
                    }
                    await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt)))
                }
            }

            performanceMonitor.recordMetric('script.generate.failure', 1, { videoId }, 'count')
            throw new Error("Failed to generate valid script after all attempts")
        },
        { videoId, config: JSON.stringify(config) }
    )
}

const validateScriptWithConfig = (parsed: ScriptResponse, config: VideoConfig): { isValid: boolean; errors: string[] } => {
    const errors: string[] = []
    const expectedScenes = {
        '15': 3,
        '30': 5,
        '60': 8
    }[config.duration]

    // Basic structure validation
    if (!parsed.content || !Array.isArray(parsed.content)) {
        errors.push("Missing or invalid content array")
        return { isValid: false, errors }
    }

    if (!parsed.title || typeof parsed.title !== 'string') {
        errors.push("Missing or invalid title")
    }

    // Scene count validation
    if (parsed.content.length !== expectedScenes) {
        errors.push(`Expected ${expectedScenes} scenes, got ${parsed.content.length}`)
    }

    // Content validation
    let totalWords = 0
    parsed.content.forEach((scene, index) => {
        if (!scene.imagePrompt || typeof scene.imagePrompt !== 'string') {
            errors.push(`Scene ${index + 1}: Missing or invalid imagePrompt`)
            return
        }

        if (!scene.contentText || typeof scene.contentText !== 'string') {
            errors.push(`Scene ${index + 1}: Missing or invalid contentText`)
            return
        }

        const imagePromptWords = scene.imagePrompt.trim().split(/\s+/).length
        const contentTextWords = scene.contentText.trim().split(/\s+/).length

        if (imagePromptWords < 20 || imagePromptWords > 35) {
            errors.push(`Scene ${index + 1}: imagePrompt has ${imagePromptWords} words, expected 20-35`)
        }

        if (contentTextWords < 12 || contentTextWords > 22) {
            errors.push(`Scene ${index + 1}: contentText has ${contentTextWords} words, expected 12-22`)
        }

        totalWords += contentTextWords
    })

    // Total word count validation
    const minTotalWords = expectedScenes * 12
    const maxTotalWords = expectedScenes * 22
    if (totalWords < minTotalWords || totalWords > maxTotalWords) {
        errors.push(`Total word count ${totalWords} is outside expected range ${minTotalWords}-${maxTotalWords}`)
    }

    return { isValid: errors.length === 0, errors }
}

const autoFixScriptWithConfig = (jsonString: string, config: VideoConfig): string => {
    console.log("🔧 Script auto-fix starting with config-aware optimization")

    let parsed: ScriptResponse
    try {
        parsed = JSON.parse(jsonString)
    } catch {
        throw new Error("Cannot parse JSON for auto-fix")
    }

    const expectedScenes = {
        '15': 3,
        '30': 5,
        '60': 8
    }[config.duration]

    // Fix scene count
    while (parsed.content.length < expectedScenes) {
        const lastScene = parsed.content[parsed.content.length - 1]
        parsed.content.push({
            imagePrompt: lastScene.imagePrompt,
            contentText: lastScene.contentText
        })
    }
    while (parsed.content.length > expectedScenes) {
        parsed.content.pop()
    }

    // Fix each scene
    parsed.content.forEach((scene, index) => {
        // Fix imagePrompt word count
        let imageWords = scene.imagePrompt.split(/\s+/)
        while (imageWords.length < 20) {
            imageWords.push('with', 'professional', 'cinematic', 'lighting', 'ultra-detailed', 'composition')
        }
        while (imageWords.length > 35) {
            imageWords.pop()
        }
        scene.imagePrompt = imageWords.slice(0, 35).join(' ')

        // Fix contentText word count
        let contentWords = scene.contentText.split(/\s+/)
        while (contentWords.length < 12) {
            contentWords.push('and', 'discover', 'the', 'amazing', 'secrets', 'that', 'will', 'transform', 'your', 'understanding')
        }
        while (contentWords.length > 22) {
            contentWords.pop()
        }
        scene.contentText = contentWords.slice(0, 22).join(' ')
    })

    // Ensure title exists
    if (!parsed.title) {
        parsed.title = `Amazing ${config.duration}s Video Guide`
    }

    console.log("🔧 Script auto-fixed with configuration optimizations")
    return JSON.stringify(parsed, null, 2)
}

// Backward compatibility function
export const generateScript = async (videoId: string) => {
    const defaultConfig: VideoConfig = {
        duration: '30',
        imageCount: 5,
        aspectRatio: '9:16'
    }
    return generateScriptWithConfig(videoId, defaultConfig)
}
