// Bring-your-own-key storage.
//
// The key never reaches this site's server. It is held in the visitor's own
// browser and sent straight from there to api.anthropic.com. That is the whole
// point of this design: the alternative — proxying through our own backend —
// would make us the custodian of other people's API keys, with every request
// header a potential leak into a log.
//
// The tradeoff is that localStorage is readable by any script running on this
// origin, so a cross-site-scripting hole would expose the key. This app renders
// no user-supplied HTML and loads no third-party scripts, which keeps that
// risk small, but it is real and the UI says so.

const STORAGE_KEY = 'drumTeacher.anthropicApiKey.v1';

// Anthropic keys look like sk-ant-api03-… — checking the prefix catches the
// common paste mistakes (a Gemini key, a truncated copy) before spending a
// round trip to be told it is invalid.
const KEY_PATTERN = /^sk-ant-[A-Za-z0-9_-]{20,}$/;

export function loadApiKey() {
    try {
        return localStorage.getItem(STORAGE_KEY) || '';
    } catch {
        return '';
    }
}

export function saveApiKey(key) {
    try {
        localStorage.setItem(STORAGE_KEY, key.trim());
    } catch { /* private browsing — the key just won't persist */ }
}

export function clearApiKey() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
}

export function validateApiKey(key) {
    const trimmed = (key ?? '').trim();
    if (!trimmed) return 'Enter your Anthropic API key.';
    if (trimmed.startsWith('AIza')) {
        return 'That looks like a Google API key. This app now uses Anthropic — keys start with sk-ant-.';
    }
    if (!KEY_PATTERN.test(trimmed)) {
        return 'That does not look like an Anthropic API key. They start with sk-ant-.';
    }
    return null;
}

// Only ever show the ends — enough to confirm which key is loaded, not enough
// to be useful over someone's shoulder.
export function maskApiKey(key) {
    if (!key || key.length < 16) return '••••';
    return `${key.slice(0, 11)}…${key.slice(-4)}`;
}
