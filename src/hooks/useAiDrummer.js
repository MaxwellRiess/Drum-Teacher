import { useState } from 'react';
import { instruments } from './useDrumMachine';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

export const useAiDrummer = (totalSteps, setGrid) => {
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState(null);

    const handleGeneratePattern = async () => {
        if (!aiPrompt.trim()) return;

        setIsGenerating(true);
        setAiError(null);

        try {
            const instrumentList = instruments.map(i => i.name).join(', ');
            const systemInstruction = `
            You are a professional drum sequencer.
            Create a drum pattern based on the user's description.
            The grid has ${instruments.length} rows (instruments) and ${totalSteps} columns (time steps).
            The rows are ordered EXACTLY as follows: ${instrumentList}.
            
            Output ONLY valid JSON. Do not output markdown code blocks.
            The JSON must be an object with a 'pattern' property.
            'pattern' must be a 2D array of booleans (true for hit, false for silence).
            Dimensions must be exactly ${instruments.length} rows x ${totalSteps} columns.
            
            Example format:
            { "pattern": [[false, true, ...], [true, false, ...], ...] }
        `;

            const userMessage = `Create a drum pattern for: "${aiPrompt}". Make it rhythmic and interesting.`;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: userMessage }] }],
                    systemInstruction: { parts: [{ text: systemInstruction }] },
                    generationConfig: {
                        responseMimeType: "application/json"
                    }
                })
            });

            if (!response.ok) throw new Error('Failed to generate pattern');

            const data = await response.json();
            const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!generatedText) throw new Error('No pattern generated');

            const parsed = JSON.parse(generatedText);

            if (parsed.pattern && Array.isArray(parsed.pattern)) {
                // Validate dimensions just in case
                const newGrid = parsed.pattern.slice(0, instruments.length).map(row => {
                    // Ensure row is boolean and correct length
                    const cleanRow = Array.isArray(row) ? row : [];
                    // Pad or truncate to match current totalSteps
                    if (cleanRow.length < totalSteps) {
                        return [...cleanRow, ...Array(totalSteps - cleanRow.length).fill(false)];
                    }
                    return cleanRow.slice(0, totalSteps);
                });
                setGrid(newGrid);
                setShowAiModal(false);
                setAiPrompt('');
            } else {
                throw new Error('Invalid pattern format received');
            }

        } catch (err) {
            console.error(err);
            setAiError('Failed to create beat. Please try again.');
        } finally {
            setIsGenerating(false);
        }
    };

    return {
        showAiModal, setShowAiModal,
        aiPrompt, setAiPrompt,
        isGenerating,
        aiError,
        handleGeneratePattern
    };
};
