// ============================================================
// tab-ai.js — Isolated AI Refinement Features
// ============================================================

const AI_CONFIG = {
    apiKey: '',
    provider: 'gemini', // default
    model: 'gemini-pro'
};

/**
 * Initializes AI settings from storage
 */
async function initAISettings() {
    const data = await chrome.storage.local.get(['ai_api_key', 'ai_provider', 'ai_model']);
    AI_CONFIG.apiKey = data.ai_api_key || '';
    AI_CONFIG.provider = data.ai_provider || 'gemini';
    AI_CONFIG.model = data.ai_model || 'gemini-2.5-flash'; // Updated as requested
}

/**
 * Main entry point for AI refinement - Uses Google Gemini API
 * @param {Object} file - The file to refine
 * @param {String} promptType - The user's refinement goal
 */
async function refineCodeWithAI(file, promptType = 'cleanup') {
    if (!AI_CONFIG.apiKey) {
        showError('Please set your Gemini API Key in Settings first.');
        switchTab('settings');
        return;
    }

    const systemPrompts = {
        'cleanup': 'Refactor this code to be more concise and clean. Remove redundant comments and console logs. Use modern best practices.',
        'comments': 'Add detailed JSDoc comments to all functions and classes in this code.',
        'types': 'Add TypeScript type definitions or JSDoc types to this code to make it more robust.',
        'optimize': 'Identify performance bottlenecks in this code and provide an optimized version.'
    };

    const userPrompt = systemPrompts[promptType] || promptType;
    const content = file.content || file.code || '';

    showStatus('Gemini is refining your code...');

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${AI_CONFIG.model}:generateContent?key=${AI_CONFIG.apiKey}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `${userPrompt}\n\nFILE: ${file.path || file.fileName}\n\nCODE:\n\`\`\`\n${content}\n\`\`\`\n\nReturn ONLY the refined code. Do not include explanations or markdown blocks.`
                    }]
                }]
            })
        });

        const data = await response.json();
        const refinedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!refinedText) throw new Error(data.error?.message || 'Empty response from Gemini');

        hideStatus();
        return {
            success: true,
            refinedContent: refinedText.replace(/^```[a-z]*\n/i, '').replace(/\n```$/i, '')
        };
    } catch (err) {
        console.error('[AI] Refinement failed:', err);
        showError('AI Refinement failed: ' + err.message);
        return { success: false, error: err.message };
    }
}
