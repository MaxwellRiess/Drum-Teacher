import { useState, useCallback } from 'react';
import Anthropic from '@anthropic-ai/sdk';
import { instruments } from './useDrumMachine';
import { loadApiKey, saveApiKey, clearApiKey, validateApiKey } from '../utils/apiKey';

const MODEL = 'claude-opus-5';

// Generous ceiling. On this model max_tokens caps thinking *and* response text
// together, so sizing it tightly around the small JSON payload would truncate
// the answer mid-object once the model reasons about the groove.
const MAX_TOKENS = 16000;

// ── Output schema ────────────────────────────────────────────────────────────
// Structured outputs constrain the response to this shape, so the old
// parse-and-hope path is gone.
//
// The pattern is keyed by instrument id rather than returned as a 2D boolean
// matrix. Two reasons: a matrix has to be read positionally, so a model that
// emits rows in a different order silently produces a scrambled beat with no
// way to detect it; and step indices are far more compact than
// instruments × steps booleans, most of which are false.
function buildPatternSchema(totalSteps) {
    const properties = {};
    for (const inst of instruments) {
        properties[inst.id] = {
            type: 'array',
            items: { type: 'integer' },
            description:
                `Zero-based step indices where ${inst.name} is struck. ` +
                `Each value must be between 0 and ${totalSteps - 1}. ` +
                `Use an empty array if this instrument is not played.`,
        };
    }
    return {
        type: 'object',
        properties,
        required: instruments.map(i => i.id),
        additionalProperties: false,
    };
}

// Structured outputs does not support numeric range constraints, so the bounds
// promised in the descriptions above are enforced here rather than by the API.
function patternToGrid(pattern, totalSteps) {
    return instruments.map(inst => {
        const row = Array(totalSteps).fill(false);
        const steps = pattern?.[inst.id];
        if (Array.isArray(steps)) {
            for (const step of steps) {
                if (Number.isInteger(step) && step >= 0 && step < totalSteps) {
                    row[step] = true;
                }
            }
        }
        return row;
    });
}

function buildSystemPrompt({ totalSteps, beats, subdiv }) {
    const noteName = { 2: 'eighth notes', 3: 'eighth-note triplets', 4: 'sixteenth notes', 6: 'sixteenth-note triplets', 8: 'thirty-second notes' }[subdiv] ?? `${subdiv} steps per beat`;

    return `You are a drum programmer writing patterns for a step sequencer.

The grid is ${beats} beats long at ${subdiv} steps per beat, so ${totalSteps} steps numbered 0 to ${totalSteps - 1}. One step is one ${noteName.replace(/s$/, '')}. Step 0 is the downbeat; beat boundaries fall on steps that are multiples of ${subdiv}.

Available instruments, given as the JSON keys you must return:
${instruments.map(i => `- ${i.id} (${i.name})`).join('\n')}

Guidance:
- Write something a drummer would actually play. Two hands and two feet: avoid asking for more simultaneous limbs than that.
- The metronome track is a click reference, not part of the groove. Leave it empty unless the user asks for a click.
- Put the backbeat where the style calls for it rather than defaulting to every pattern sounding the same.
- Use hihat_open sparingly, as an accent — it is the open hi-hat.
- Silence is part of a groove. Do not fill every step.`;
}

export const useAiDrummer = ({ totalSteps, beats, subdiv, setGrid }) => {
    const [showAiModal, setShowAiModal] = useState(false);
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [aiError, setAiError] = useState(null);
    const [apiKey, setApiKeyState] = useState(() => loadApiKey());
    const [keyError, setKeyError] = useState(null);

    const setApiKey = useCallback((key) => {
        const problem = validateApiKey(key);
        setKeyError(problem);
        if (problem) return false;
        const trimmed = key.trim();
        saveApiKey(trimmed);
        setApiKeyState(trimmed);
        setAiError(null);
        return true;
    }, []);

    const forgetApiKey = useCallback(() => {
        clearApiKey();
        setApiKeyState('');
        setKeyError(null);
    }, []);

    const handleGeneratePattern = useCallback(async () => {
        if (!aiPrompt.trim()) return;
        if (!apiKey) {
            setAiError('Add your Anthropic API key first.');
            return;
        }

        setIsGenerating(true);
        setAiError(null);

        try {
            const client = new Anthropic({
                apiKey,
                // The key belongs to the person typing it and goes straight to
                // Anthropic. See src/utils/apiKey.js for why this is preferred
                // over proxying through our own server.
                dangerouslyAllowBrowser: true,
            });

            const response = await client.messages.create({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                system: buildSystemPrompt({ totalSteps, beats, subdiv }),
                messages: [{
                    role: 'user',
                    content: `Write a drum pattern for: "${aiPrompt.trim()}"`,
                }],
                output_config: {
                    format: { type: 'json_schema', schema: buildPatternSchema(totalSteps) },
                    // Enough reasoning to make musical choices without making
                    // the user wait on a generate button.
                    effort: 'medium',
                },
            });

            // Check before reading content: on a refusal the content array is
            // empty or partial, and indexing into it blindly would throw.
            if (response.stop_reason === 'refusal') {
                throw new Error('Claude declined that prompt. Try describing the beat differently.');
            }
            if (response.stop_reason === 'max_tokens') {
                throw new Error('The response was cut short. Try a simpler description.');
            }

            const textBlock = response.content.find(block => block.type === 'text');
            if (!textBlock) throw new Error('No pattern came back. Try again.');

            // Guaranteed to parse and match the schema — that is what
            // structured outputs buys over prompting for JSON and hoping.
            setGrid(patternToGrid(JSON.parse(textBlock.text), totalSteps));
            setShowAiModal(false);
            setAiPrompt('');
        } catch (err) {
            setAiError(describeError(err));
        } finally {
            setIsGenerating(false);
        }
    }, [aiPrompt, apiKey, totalSteps, beats, subdiv, setGrid]);

    return {
        showAiModal, setShowAiModal,
        aiPrompt, setAiPrompt,
        isGenerating,
        aiError,
        handleGeneratePattern,
        apiKey, setApiKey, forgetApiKey, keyError,
    };
};

// Typed SDK errors rather than string-matching messages. APIConnectionError is
// checked before APIError because it is a subclass of it.
function describeError(err) {
    if (err instanceof Anthropic.AuthenticationError) {
        return 'That API key was rejected. Check it and try again.';
    }
    if (err instanceof Anthropic.PermissionDeniedError) {
        return 'That key does not have access to this model.';
    }
    if (err instanceof Anthropic.RateLimitError) {
        return 'Rate limited by the API. Wait a moment and try again.';
    }
    if (err instanceof Anthropic.APIConnectionError) {
        return 'Could not reach the API. Check your connection.';
    }
    if (err instanceof Anthropic.APIError) {
        return `API error ${err.status}: ${err.message}`;
    }
    return err?.message || 'Failed to create beat. Please try again.';
}
