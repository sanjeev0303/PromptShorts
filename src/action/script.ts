import Groq from "groq-sdk"

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
})

interface ScriptScene {
    imagePrompt: string;
    contentText: string;
}

interface ScriptResponse {
    content: ScriptScene[];
}

export const generateScript = async (prompt: string): Promise<string | null> => {
    const maxAttempts = 4; // Increased attempts
    const temperatures = [0.1, 0.05, 0.3, 0.01]; // Even lower temperatures for consistency

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            console.log(`🤖 Generating script (attempt ${attempt}/${maxAttempts}) with temperature ${temperatures[attempt - 1]}...`);            // Enhanced meta-prompt based on your specifications
        const metaPrompt = `You are orchestrating an AI-powered video generation pipeline that transforms text prompts into 30-second videos with synchronized visuals, narration, and captions.

## Your Primary Objective
Generate a structured JSON script that precisely defines a 30-second video with 5 scenes, where each scene contains:
1. A photorealistic image prompt for visual generation
2. Narration text that will be converted to speech

## Strict Requirements

### Timing Constraints
- **Total Duration**: Exactly 30 seconds
- **Scene Distribution**: 5 scenes × 6 seconds each
- **Audio Pacing**: 150-160 words per minute (75-85 total words)

### Content Structure
{
  "content": [
    {
      "imagePrompt": "string - EXACTLY 20-35 words, photorealistic description",
      "contentText": "string - EXACTLY 12-22 words, natural narration"
    }
    // ... exactly 5 objects
  ]
}

### Image Prompt Guidelines
Each imagePrompt must be EXACTLY 20-35 words and must:
- Start with "Photorealistic" or "Ultra-realistic"
- Include specific details about:
  - Subject positioning and action
  - Lighting conditions (natural, studio, golden hour, etc.)
  - Camera angle (wide shot, close-up, aerial, eye-level)
  - Environment/background details
  - Color palette or mood
- Be self-contained (no references to other scenes)
- Maintain overall **visual coherence**, but ensure **scene-to-scene diversity**:
  - Each scene must depict a **different subject, environment, or perspective** related to its narration
  - Avoid reusing the same setting, lighting, or angle across multiple scenes
  - Match the narration context exactly (the narration defines the image theme)


### Narration Text Guidelines
Each contentText must be EXACTLY 12-22 words and must:
- Flow naturally when read aloud
- Use active voice and present tense
- Avoid complex pronunciations or tongue-twisters
- Include natural pauses (commas, periods)
- Match the visual content temporally
- Build a coherent narrative arc across all 5 scenes

## Scene Flow Template

### Scene 1: Hook (0-6 seconds)
- **Purpose**: Capture attention, introduce topic
- **Image**: Establishing shot or compelling visual (20-35 words)
- **Text**: Question or intriguing statement (12-22 words)

### Scene 2: Context (6-12 seconds)
- **Purpose**: Provide background or problem statement
- **Image**: Relevant supporting visual (20-35 words)
- **Text**: Explain why this matters (12-22 words)

### Scene 3: Core Content (12-18 seconds)
- **Purpose**: Main information or demonstration
- **Image**: Key visual explanation (20-35 words)
- **Text**: Central message or instruction (12-22 words)

### Scene 4: Details/Benefits (18-24 seconds)
- **Purpose**: Elaborate or show results
- **Image**: Close-up or result visualization (20-35 words)
- **Text**: Specific benefits or outcomes (12-22 words)

### Scene 5: Conclusion/CTA (24-30 seconds)
- **Purpose**: Summarize and inspire action
- **Image**: Memorable closing visual (20-35 words)
- **Text**: Call-to-action or key takeaway (12-22 words)

## Quality Checks
Before outputting, verify:
- Exactly 5 scenes present
- Total word count: 70-85 words (sum of all contentText)
- Each imagePrompt: EXACTLY 20-35 words
- Each contentText: EXACTLY 12-22 words
- No special characters that break JSON
- Visual descriptions are generation-ready
- Narration reads smoothly aloud
- Logical narrative progression

CRITICAL DIVERSITY RULE:
Do not generate five similar office scenes, five similar landscapes, or repetitive close-ups.
Each scene must visually change in subject, background, lighting, or angle to reflect the narration.
The sequence should feel like a natural visual progression across different but connected scenes.

## Example Output Structure:
{
  "content": [
    {
      "imagePrompt": "Photorealistic wide shot of a modern entrepreneur working late at sleek glass office with city lights background, professional cinematic lighting, ultra-detailed composition",
      "contentText": "Have you ever wondered why some entrepreneurs succeed while others struggle to make their first million?"
    },
    {
      "imagePrompt": "Ultra-realistic close-up of hands typing on laptop with financial charts displayed on multiple glowing screens, golden hour lighting, cinematic depth",
      "contentText": "The secret lies in understanding market psychology and timing your strategic moves perfectly when opportunities arise."
    },
    {
      "imagePrompt": "Photorealistic aerial view of bustling business district with modern skyscrapers and busy professionals walking on streets, bright daylight, sharp focus",
      "contentText": "Successful entrepreneurs leverage three key principles that separate them from the competition in today's market."
    },
    {
      "imagePrompt": "Ultra-realistic shot of confident business person presenting to engaged audience in modern conference room, professional lighting, award-winning photography style",
      "contentText": "They master the art of strategic networking, data-driven decision making, and consistent value creation for customers."
    },
    {
      "imagePrompt": "Photorealistic celebration scene of diverse team raising hands in victory in modern office space, warm lighting, vibrant colors, perfect composition",
      "contentText": "Start implementing these proven strategies today and watch your entrepreneurial journey transform into remarkable success."
    }
  ]
}

Topic: "${prompt}"

Return ONLY the JSON object. No preamble, no explanation, no markdown code blocks.`;

            const response = await groq.chat.completions.create({
                model: "openai/gpt-oss-120b",
                messages: [
                    {
                        role: "system",
                        content: `You are an expert video script writer with precise word counting skills. CRITICAL REQUIREMENTS:
                        - imagePrompt: EXACTLY 20-35 words (count every word carefully)
                        - contentText: EXACTLY 12-22 words (count every word carefully)
                        - Total narration: EXACTLY 70-85 words (sum of all contentText)

                        BEFORE submitting, COUNT EACH FIELD'S WORDS. If any field is outside the range, rewrite it to fit exactly.
                        Use simple, clear language. Avoid overly complex phrases that inflate word count.`
                    },
                    {
                        role: "user",
                        content: metaPrompt
                    }
                ],
                response_format: {
                    "type": "json_object"
                },
                temperature: temperatures[attempt - 1],
                max_tokens: 3000
            });

            const scriptContent = response.choices[0]?.message?.content;

            if (!scriptContent) {
                throw new Error("No script content generated");
            }

            // Validate and fix the script structure
            const validation = validateScript(scriptContent);
            if (!validation.isValid) {
                console.error(`Script validation failed (attempt ${attempt}):`, validation.errors);

                // Try to auto-fix the script before giving up
                const fixedScript = autoFixScript(scriptContent);
                if (fixedScript) {
                    const fixedValidation = validateScript(fixedScript);
                    if (fixedValidation.isValid) {
                        console.log(`✅ Script auto-fixed and validated successfully on attempt ${attempt}`);
                        return fixedScript;
                    }
                }

                if (attempt === maxAttempts) {
                    throw new Error(`Script validation failed after ${maxAttempts} attempts: ${validation.errors.join(", ")}`);
                }

                console.log(`⏳ Retrying with different temperature...`);
                continue; // Try next attempt
            }

            console.log(`✅ Script generated and validated successfully on attempt ${attempt}`);
            return scriptContent;

        } catch (error) {
            console.error(`Error on attempt ${attempt}:`, error);

            if (attempt === maxAttempts) {
                console.error("All script generation attempts failed");
                return null;
            }

            // Continue to next attempt
        }
    }

    return null;
}

function validateScript(scriptJson: string): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
        const parsed: ScriptResponse = JSON.parse(scriptJson);

        // Check if content array exists
        if (!parsed.content || !Array.isArray(parsed.content)) {
            errors.push("Missing or invalid 'content' array");
            return { isValid: false, errors };
        }

        // Check exact scene count
        if (parsed.content.length !== 5) {
            errors.push(`Expected exactly 5 scenes, got ${parsed.content.length}`);
        }

        // Validate each scene
        parsed.content.forEach((scene, index) => {
            if (!scene.imagePrompt || typeof scene.imagePrompt !== 'string') {
                errors.push(`Scene ${index + 1}: Missing or invalid imagePrompt`);
            } else {
                const imageWords = scene.imagePrompt.split(' ').length;
                if (imageWords < 20 || imageWords > 35) {
                    errors.push(`Scene ${index + 1}: imagePrompt should be 20-35 words, got ${imageWords}`);
                }

                if (!scene.imagePrompt.toLowerCase().includes('photorealistic') &&
                    !scene.imagePrompt.toLowerCase().includes('ultra-realistic')) {
                    errors.push(`Scene ${index + 1}: imagePrompt should start with 'Photorealistic' or 'Ultra-realistic'`);
                }
            }

            if (!scene.contentText || typeof scene.contentText !== 'string') {
                errors.push(`Scene ${index + 1}: Missing or invalid contentText`);
            } else {
                const contentWords = scene.contentText.split(' ').length;
                if (contentWords < 12 || contentWords > 22) {
                    errors.push(`Scene ${index + 1}: contentText should be 12-22 words, got ${contentWords}`);
                }
            }
        });

        // Check total word count for narration
        const totalWords = parsed.content.reduce((sum, scene) =>
            sum + (scene.contentText?.split(' ').length || 0), 0);

        if (totalWords < 70 || totalWords > 85) {
            errors.push(`Total narration should be 70-85 words, got ${totalWords}`);
        }

    } catch (parseError) {
        errors.push("Invalid JSON format");
    }

    return { isValid: errors.length === 0, errors };
}

function autoFixScript(scriptJson: string): string | null {
    try {
        const parsed: ScriptResponse = JSON.parse(scriptJson);

        if (!parsed.content || !Array.isArray(parsed.content)) {
            return null;
        }

        // Fix each scene
        parsed.content.forEach((scene, index) => {
            // Fix imagePrompt length
            if (scene.imagePrompt) {
                const imageWords = scene.imagePrompt.split(' ');

                // If too long, trim to 35 words
                if (imageWords.length > 35) {
                    scene.imagePrompt = imageWords.slice(0, 35).join(' ');
                }

                // If too short, add descriptive words
                else if (imageWords.length < 20) {
                    const additions = [
                        ', professional cinematic lighting',
                        ', ultra-detailed 8k resolution',
                        ', perfect composition and framing',
                        ', vibrant colors and sharp focus',
                        ', award-winning photography style'
                    ];

                    let currentWords = imageWords.length;
                    let additionIndex = 0;

                    while (currentWords < 20 && additionIndex < additions.length) {
                        const addition = additions[additionIndex];
                        const additionWords = addition.split(' ').length;

                        if (currentWords + additionWords <= 35) {
                            scene.imagePrompt += addition;
                            currentWords += additionWords;
                        }
                        additionIndex++;
                    }
                }

                // Ensure it starts with photorealistic/ultra-realistic
                if (!scene.imagePrompt.toLowerCase().includes('photorealistic') &&
                    !scene.imagePrompt.toLowerCase().includes('ultra-realistic')) {
                    scene.imagePrompt = 'Photorealistic ' + scene.imagePrompt.replace(/^(Ultra-realistic|Photorealistic)\s*/i, '');
                }
            }

            // Fix contentText length
            if (scene.contentText) {
                const contentWords = scene.contentText.split(' ');

                // If too long, trim to 22 words
                if (contentWords.length > 22) {
                    scene.contentText = contentWords.slice(0, 22).join(' ');
                    // Ensure it ends properly
                    if (!scene.contentText.match(/[.!?]$/)) {
                        scene.contentText = scene.contentText.replace(/,?\s*$/, '') + '.';
                    }
                }

                // If too short, try to expand naturally
                else if (contentWords.length < 12) {
                    const expansions = [
                        ' in today\'s competitive market',
                        ' for modern businesses and entrepreneurs',
                        ' that can transform your results',
                        ' and achieve remarkable success',
                        ' with proven strategies and methods'
                    ];

                    let currentWords = contentWords.length;
                    let expansionIndex = 0;

                    while (currentWords < 12 && expansionIndex < expansions.length) {
                        const expansion = expansions[expansionIndex];
                        const expansionWords = expansion.split(' ').length;

                        if (currentWords + expansionWords <= 22) {
                            scene.contentText += expansion;
                            currentWords += expansionWords;
                        }
                        expansionIndex++;
                    }
                }
            }
        });

        // Check total word count and adjust if needed
        let totalWords = parsed.content.reduce((sum, scene) =>
            sum + (scene.contentText?.split(' ').length || 0), 0);

        // If total is still too high, trim each contentText proportionally
        if (totalWords > 85) {
            const targetReduction = totalWords - 80; // Aim for 80 words
            const reductionPerScene = Math.ceil(targetReduction / 5);

            parsed.content.forEach(scene => {
                if (scene.contentText) {
                    const words = scene.contentText.split(' ');
                    if (words.length > 12) { // Only reduce if above minimum
                        const newLength = Math.max(12, words.length - reductionPerScene);
                        scene.contentText = words.slice(0, newLength).join(' ');
                        // Ensure proper ending
                        if (!scene.contentText.match(/[.!?]$/)) {
                            scene.contentText = scene.contentText.replace(/,?\s*$/, '') + '.';
                        }
                    }
                }
            });
        }

        // If total is too low, expand the middle scenes
        totalWords = parsed.content.reduce((sum, scene) =>
            sum + (scene.contentText?.split(' ').length || 0), 0);

        if (totalWords < 70) {
            const targetIncrease = 75 - totalWords; // Aim for 75 words
            const increasePerScene = Math.ceil(targetIncrease / 3); // Focus on middle scenes

            [1, 2, 3].forEach(sceneIndex => { // Scenes 2, 3, 4 (0-indexed)
                if (parsed.content[sceneIndex]?.contentText) {
                    const scene = parsed.content[sceneIndex];
                    const words = scene.contentText.split(' ');
                    if (words.length < 20) { // Only increase if below maximum
                        const additions = [
                            ' effectively and efficiently',
                            ' with proven methods',
                            ' for lasting results',
                            ' in your industry',
                            ' that delivers value'
                        ];

                        let currentLength = words.length;
                        for (const addition of additions) {
                            if (currentLength + addition.split(' ').length <= 22) {
                                scene.contentText += addition;
                                currentLength += addition.split(' ').length;
                                break;
                            }
                        }
                    }
                }
            });
        }

        console.log('🔧 Script auto-fixed for word count compliance');
        return JSON.stringify(parsed, null, 2);

    } catch (error) {
        console.error('Failed to auto-fix script:', error);
        return null;
    }
}
