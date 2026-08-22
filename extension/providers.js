// ChatGPT adapter. Selectors live here — if ChatGPT changes its DOM, edit this.
// ponytail: single provider, plain object. One place to fix when selectors rot.

const PROVIDERS = {
  chatgpt: {
    id: "chatgpt",
    label: "ChatGPT",
    host: "chatgpt.com",
    // temporary chat straight from the URL — no history, no toggle
    newChatUrl: "https://chatgpt.com/?temporary-chat=true",
    inputSelector: "#prompt-textarea",
    sendSelector: 'button[data-testid="send-button"]',
    responseSelector: '[data-message-author-role="assistant"]',
    stopSelector: 'button[data-testid="stop-button"]'
  }
};

// export for service worker (importScripts) and expose on window for content script
if (typeof self !== "undefined") self.PROVIDERS = PROVIDERS;
