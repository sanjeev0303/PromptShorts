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
  const maxAttempts = 4;
  const temperatures = [0.1, 0.05, 0.3, 0.01];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🤖 Generating script (attempt ${attempt}/${maxAttempts}) with temperature ${temperatures[attempt - 1]}...`);

      const metaPrompt = `You are orchestrating an AI-powered video generation pipeline that transforms text prompts into 30-second videos with synchronized visuals, narration, and captions.

## Your Primary Objective
Generate a structured JSON script that precisely defines a 30-second video with 5 scenes, where each scene contains:
1. A photorealistic image prompt for visual generation
2. Narration text that will be converted to speech

## CRITICAL WORD COUNT REQUIREMENTS (COUNT CAREFULLY)

### imagePrompt Requirements:
- EXACTLY 20-35 words per scene
- Must start with "Ultra-realistic", "Cinematic", "High-definition", or "Professional"
- Include: subject, setting, lighting, camera angle, colors, mood
- Each scene must be visually DIFFERENT (different settings, subjects, perspectives)
- Example: "Ultra-realistic aerial view of ancient Indian temple during golden hour with warm sunlight streaming through ornate pillars showcasing intricate stone carvings and peaceful courtyard atmosphere"

### contentText Requirements:
- EXACTLY 12-22 words per scene  
- Natural speaking rhythm, active voice, present tense
- Must flow as narration when read aloud
- Example: "India's rich cultural heritage spans thousands of years, featuring magnificent architecture that tells stories of ancient civilizations and traditions."

### Total Requirements:
- Exactly 5 scenes in content array
- Total narration across all scenes: 70-85 words
- Avoid repetitive keywords across scenes

## Content Structure (COPY THIS EXACTLY):
{
  "content": [
    {
      "imagePrompt": "Ultra-realistic [subject] in [setting] with [lighting] showing [details] featuring [colors and mood] captured with [camera details]",
      "contentText": "Engaging narration text that flows naturally when spoken aloud and contains exactly twelve to twenty-two words per scene."
    },
    {
      "imagePrompt": "Cinematic [different subject] at [different location] during [different time] with [different lighting] displaying [unique details] in [different style]",
      "contentText": "Continue the narrative flow with natural speech patterns ensuring proper word count between twelve and twenty-two words exactly."
    },
    {
      "imagePrompt": "High-definition [another subject] within [new environment] featuring [specific lighting] highlighting [distinctive elements] using [different camera angle] with [unique atmosphere]",
      "contentText": "Build upon previous content while maintaining natural speaking rhythm and staying within the twelve to twenty-two word requirement."
    },
    {
      "imagePrompt": "Professional [unique subject] positioned in [fresh setting] with [varied lighting] emphasizing [key details] captured from [new perspective] creating [distinct mood]",
      "contentText": "Develop the narrative further using conversational tone while carefully maintaining the twelve to twenty-two word count per scene."
    },
    {
      "imagePrompt": "Ultra-realistic [final subject] set against [concluding backdrop] with [dramatic lighting] showcasing [important elements] filmed with [specific technique] evoking [emotional response]",
      "contentText": "Conclude the narrative effectively with natural speech flow while ensuring exactly twelve to twenty-two words complete this final scene."
    }
  ]
}

## Quality Checklist:
- ✅ Exactly 5 scenes
- ✅ Each imagePrompt: 20-35 words (COUNT THEM)
- ✅ Each contentText: 12-22 words (COUNT THEM)  
- ✅ Total narration: 70-85 words
- ✅ Each scene visually distinct
- ✅ No repeated keywords more than 2 times
- ✅ Natural speaking flow

Topic: "${prompt}"

COUNT THE WORDS CAREFULLY. Return ONLY the JSON object with exactly 5 scenes.`;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `You are an expert video script writer with precise word counting skills.`
          },
          { role: "user", content: metaPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: temperatures[attempt - 1],
        max_tokens: 3000
      });

      const scriptContent = response.choices[0]?.message?.content;
      if (!scriptContent) throw new Error("No script content generated");

      const validation = validateScript(scriptContent);
      if (!validation.isValid) {
        console.error(`❌ Validation failed (attempt ${attempt}):`, validation.errors);

        // Try auto-fix twice if needed
        let fixedScript = autoFixScript(scriptContent);
        if (fixedScript) {
          let fixedValidation = validateScript(fixedScript);
          if (!fixedValidation.isValid) {
            // Try fixing the fixed script one more time
            fixedScript = autoFixScript(fixedScript);
            if (fixedScript) {
              fixedValidation = validateScript(fixedScript);
            }
          }
          
          if (fixedValidation.isValid) {
            console.log(`✅ Script auto-fixed and validated successfully on attempt ${attempt}`);
            return fixedScript;
          }
        }

        if (attempt === maxAttempts) {
          throw new Error(`Script validation failed after ${maxAttempts} attempts: ${validation.errors.join(", ")}`);
        }

        console.log(`⏳ Retrying with different temperature...`);
        continue;
      }

      console.log(`✅ Script generated and validated successfully on attempt ${attempt}`);
      return scriptContent;

    } catch (error) {
      console.error(`Error on attempt ${attempt}:`, error);
      if (attempt === maxAttempts) {
        console.error("All script generation attempts failed");
        return null;
      }
    }
  }
  return null;
};

function validateScript(scriptJson: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  try {
    const parsed: ScriptResponse = JSON.parse(scriptJson);
    if (!parsed.content || !Array.isArray(parsed.content)) {
      errors.push("Missing or invalid 'content' array");
      return { isValid: false, errors };
    }

    if (parsed.content.length !== 5) {
      errors.push(`Expected exactly 5 scenes, got ${parsed.content.length}`);
    }

    const seenKeywords: Record<string, number> = {};
    parsed.content.forEach((scene, index) => {
      // Validate imagePrompt
      if (!scene.imagePrompt || typeof scene.imagePrompt !== "string") {
        errors.push(`Scene ${index + 1}: Missing or invalid imagePrompt`);
      } else {
        const words = scene.imagePrompt.trim().split(/\s+/);
        if (words.length < 20 || words.length > 35) {
          errors.push(`Scene ${index + 1}: imagePrompt must be 20-35 words, got ${words.length}`);
        }
        if (!scene.imagePrompt.toLowerCase().startsWith("photorealistic") &&
            !scene.imagePrompt.toLowerCase().startsWith("ultra-realistic")) {
          errors.push(`Scene ${index + 1}: imagePrompt must start with 'Photorealistic' or 'Ultra-realistic'`);
        }
        // Collect keywords for repetition check
        words.filter(w => w.length > 4).forEach(w => {
          seenKeywords[w.toLowerCase()] = (seenKeywords[w.toLowerCase()] || 0) + 1;
        });
      }

      // Validate contentText
      if (!scene.contentText || typeof scene.contentText !== "string") {
        errors.push(`Scene ${index + 1}: Missing or invalid contentText`);
      } else {
        const words = scene.contentText.trim().split(/\s+/);
        if (words.length < 12 || words.length > 22) {
          errors.push(`Scene ${index + 1}: contentText must be 12-22 words, got ${words.length}`);
        }
      }
    });

    // Total narration word count
    const totalWords = parsed.content.reduce((sum, scene) =>
      sum + (scene.contentText?.split(/\s+/).length || 0), 0
    );
    if (totalWords < 70 || totalWords > 85) {
      errors.push(`Total narration must be 70-85 words, got ${totalWords}`);
    }

    // Repetition check
    Object.entries(seenKeywords).forEach(([word, count]) => {
      if (count >= 3) {
        errors.push(`Repetitive imagery detected: keyword "${word}" appears in ${count} scenes`);
      }
    });

  } catch (e) {
    errors.push("Invalid JSON format");
  }

  return { isValid: errors.length === 0, errors };
}

function autoFixScript(scriptJson: string): string | null {
  try {
    const parsed: ScriptResponse = JSON.parse(scriptJson);
    if (!parsed.content || !Array.isArray(parsed.content)) return null;

    const replacementMap: Record<string, string[]> = {
      "office": ["studio", "creative workspace", "outdoor plaza", "conference hall"],
      "laptop": ["tablet", "smartphone", "whiteboard", "holographic screen"],
      "cityscape": ["mountains", "beachfront", "village market", "forest trail"],
      "meeting": ["brainstorming", "presentation", "casual discussion", "workshop"],
      "photorealistic": ["Ultra-realistic", "Cinematic", "High-definition", "Professional"],
      "camera": ["perspective", "viewpoint", "angle", "composition"],
      "view": ["scene", "landscape", "setting", "environment"],
      "light": ["illumination", "brightness", "glow", "radiance"],
      "indian": ["South Asian", "subcontinental", "regional", "local"]
    };

    const expansionPhrases = {
      imagePrompt: [
        "with dramatic lighting and cinematic composition",
        "featuring vibrant colors and sharp professional focus",
        "captured with premium camera equipment and expert framing",
        "showing intricate details and authentic textures throughout",
        "displaying rich contrast and balanced exposure settings"
      ],
      contentText: [
        "with remarkable precision and detailed explanation for viewers",
        "showcasing incredible features and benefits that inspire action",
        "demonstrating proven results and transformative impact for everyone",
        "revealing essential insights and valuable knowledge for success",
        "providing comprehensive understanding and practical applications today"
      ]
    };

    parsed.content.forEach((scene, index) => {
      // Fix imagePrompt length - be more aggressive
      if (scene.imagePrompt) {
        let words = scene.imagePrompt.trim().split(/\s+/);

        // Replace repetitive keywords first
        for (const [keyword, alternatives] of Object.entries(replacementMap)) {
          const regex = new RegExp(`\\b${keyword}\\b`, "gi");
          if (regex.test(scene.imagePrompt)) {
            const alt = alternatives[index % alternatives.length];
            scene.imagePrompt = scene.imagePrompt.replace(regex, alt);
          }
        }

        // Recalculate words after replacement
        words = scene.imagePrompt.trim().split(/\s+/);

        if (words.length < 20) {
          // Add multiple expansion phrases to reach minimum - be very aggressive
          const expansions = [
            "with dramatic professional lighting and cinematic composition featuring vibrant colors and expert camera work",
            "featuring exceptional detail and authentic textures with premium equipment and masterful framing throughout the scene",
            "captured with high-end photography techniques showcasing rich contrast and balanced exposure settings with artistic flair",
            "displaying intricate visual elements and stunning clarity using advanced cinematography and perfect lighting conditions",
            "showing remarkable depth and visual impact with professional grade equipment and expertly crafted composition"
          ];
          const expansion = expansions[index % expansions.length];
          scene.imagePrompt = scene.imagePrompt.trim() + " " + expansion;
          words = scene.imagePrompt.trim().split(/\s+/);
        }

        // If still not enough, add more
        if (words.length < 20) {
          scene.imagePrompt += " with stunning visual appeal and professional quality.";
          words = scene.imagePrompt.trim().split(/\s+/);
        }

        if (words.length > 35) {
          scene.imagePrompt = words.slice(0, 35).join(" ");
        }

        // Ensure it starts with a realistic prefix
        if (!scene.imagePrompt.toLowerCase().startsWith("photorealistic") &&
            !scene.imagePrompt.toLowerCase().startsWith("ultra-realistic") &&
            !scene.imagePrompt.toLowerCase().startsWith("cinematic") &&
            !scene.imagePrompt.toLowerCase().startsWith("high-definition")) {
          const prefixes = ["Ultra-realistic", "Cinematic", "High-definition", "Professional"];
          scene.imagePrompt = prefixes[index % prefixes.length] + " " + scene.imagePrompt;
        }
      }

      // Fix contentText length - be more aggressive
      if (scene.contentText) {
        let words = scene.contentText.trim().split(/\s+/);
        
        if (words.length < 12) {
          // Add substantial expansion to reach minimum - be very aggressive
          const expansions = [
            " with remarkable precision and detailed explanation that provides viewers with comprehensive understanding",
            " showcasing incredible features and proven benefits that inspire immediate action and meaningful results",
            " demonstrating essential strategies and transformative impact that creates lasting success for everyone",
            " revealing valuable insights and practical knowledge that enables significant growth and achievement",
            " providing expert guidance and innovative solutions that deliver exceptional outcomes and positive change"
          ];
          const expansion = expansions[index % expansions.length];
          scene.contentText = scene.contentText.trim() + expansion;
          words = scene.contentText.trim().split(/\s+/);
        }

        // If still not enough, add more
        if (words.length < 12) {
          scene.contentText += " ensuring maximum effectiveness and optimal results for lasting success.";
          words = scene.contentText.trim().split(/\s+/);
        }

        if (words.length > 22) {
          scene.contentText = words.slice(0, 22).join(" ");
        }

        // Ensure proper sentence ending
        if (!/[.!?]$/.test(scene.contentText)) {
          scene.contentText = scene.contentText.replace(/,?\s*$/, "") + ".";
        }
      }
    });

    // Final check - if total narration is still too low, expand each scene further
    const totalWords = parsed.content.reduce((sum, scene) =>
      sum + (scene.contentText?.split(/\s+/).length || 0), 0
    );

    if (totalWords < 70) {
      const wordsNeeded = 70 - totalWords;
      console.log(`🔧 Need to add ${wordsNeeded} more words. Current total: ${totalWords}`);
      
      parsed.content.forEach((scene, index) => {
        if (scene.contentText) {
          const currentWords = scene.contentText.split(/\s+/).length;
          if (currentWords < 20) { // Expand to near maximum
            // More aggressive expansion
            const expansions = [
              " offering comprehensive solutions and remarkable benefits that deliver lasting success and transformative results",
              " providing essential insights and valuable knowledge that enables growth and achievement for everyone involved",
              " showcasing incredible features and proven strategies that inspire action and drive meaningful progress forward",
              " revealing important details and practical applications that create opportunities for advancement and development",
              " demonstrating exceptional quality and innovative approaches that generate positive outcomes and meaningful impact"
            ];
            const expansion = expansions[index % expansions.length];
            scene.contentText = scene.contentText.replace(/\.$/, "") + expansion + ".";
            
            // Ensure we don't exceed the limit
            const newWords = scene.contentText.split(/\s+/);
            if (newWords.length > 22) {
              scene.contentText = newWords.slice(0, 22).join(" ") + ".";
            }
          }
        }
      });
    }

    console.log("🔧 Script auto-fix starting with aggressive word count and diversity compliance");
    
    // Debug: Log current state
    parsed.content.forEach((scene, i) => {
      console.log(`Scene ${i+1}: imagePrompt=${scene.imagePrompt?.split(/\s+/).length || 0} words, contentText=${scene.contentText?.split(/\s+/).length || 0} words`);
    });
    
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    console.error("Failed to auto-fix script:", e);
    return null;
  }
}
