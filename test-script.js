import { generateScript } from '../src/action/script'

async function testScript() {
    console.log('🧪 Testing script generation...');

    const testPrompt = "AI-powered productivity tools for entrepreneurs";

    try {
        const result = await generateScript(testPrompt);

        if (result) {
            console.log('✅ Script generated successfully!');

            // Parse and analyze the result
            const parsed = JSON.parse(result);
            console.log(`📊 Generated ${parsed.content.length} scenes`);

            let totalWords = 0;
            parsed.content.forEach((scene, index) => {
                const imageWords = scene.imagePrompt.split(' ').length;
                const contentWords = scene.contentText.split(' ').length;
                totalWords += contentWords;

                console.log(`Scene ${index + 1}:`);
                console.log(`  📝 Content: ${contentWords} words`);
                console.log(`  🖼️  Image: ${imageWords} words`);
            });

            console.log(`\n📊 Total narration words: ${totalWords}`);
            console.log('✅ Script validation should pass!');

        } else {
            console.error('❌ Script generation failed');
        }
    } catch (error) {
        console.error('❌ Script test failed:', error);
    }
}

// Run the test
testScript().then(() => {
    process.exit(0);
}).catch((error) => {
    console.error('Test failed:', error);
    process.exit(1);
});
