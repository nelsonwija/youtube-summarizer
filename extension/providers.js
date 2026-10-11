// ChatGPT adapter. Selectors live here — if ChatGPT changes its DOM, edit this.
// ponytail: single provider, plain object. One place to fix when selectors rot.

const PROVIDERS = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    host: "chatgpt.com",
    // temporary chat straight from the URL — no history, no toggle
    newChatUrl: "https://chatgpt.com/?temporary-chat=true",
    // composer lost its #prompt-textarea id (Oct 2026); keep old id as fallback
    inputSelector: '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
    // data-testids dropped (Oct 2026); aria-label is what's left
    sendSelector: 'button[data-testid="send-button"], button[aria-label="Send"]',
    // markdown body only — the wider turn unit also holds a "ChatGPT said:" heading
    responseSelector:
      '[data-message-author-role="assistant"], [data-markdown-text-style="assistant-message"]',
    stopSelector: 'button[data-testid="stop-button"], button[aria-label^="Stop"]'
  }
};

// export for service worker (importScripts) and expose on window for content script
if (typeof self !== "undefined") self.PROVIDERS = PROVIDERS;
