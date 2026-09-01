// Service worker: orchestrates transcript -> provider tab -> reply.
importScripts("providers.js");

const TRANSCRIPT_SERVER = "http://localhost:8791";

// Fetch transcript from the local Python server (youtube-transcript-api).
async function fetchTranscript(videoId) {
  let resp;
  try {
    resp = await fetch(`${TRANSCRIPT_SERVER}/transcript?v=${videoId}`);
  } catch {
    throw new Error(
      "Transcript server not reachable — start it: `python server.py` (see README)."
    );
  }
  const j = await resp.json();
  if (!j.ok) throw new Error(j.error || "Transcript fetch failed.");
  return j.transcript;
}

const DEFAULT_TEMPLATE =
  "Summarize this YouTube video from its transcript. Give a short overview then key points as bullets.\n\nTitle: {title}\n\nTranscript:\n{transcript}";

function getConfig() {
  return new Promise(resolve => {
    chrome.storage.sync.get({ promptTemplate: DEFAULT_TEMPLATE }, resolve);
  });
}

function sendToTab(tabId, msg) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, msg, res => {
      if (chrome.runtime.lastError)
        return reject(new Error(chrome.runtime.lastError.message));
      resolve(res);
    });
  });
}

function waitForTabComplete(tabId, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const done = () => {
      chrome.tabs.onUpdated.removeListener(listener);
      clearTimeout(timer);
      // content_scripts run at document_idle; small grace for the SPA to boot
      setTimeout(resolve, 800);
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") done();
    };
    chrome.tabs.onUpdated.addListener(listener);
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("Provider tab took too long to load."));
    }, timeout);
    // maybe already complete
    chrome.tabs.get(tabId, tab => {
      if (!chrome.runtime.lastError && tab.status === "complete") done();
    });
  });
}

// Always open a fresh temporary-chat tab.
async function openProviderTab(adapter) {
  const tab = await chrome.tabs.create({ url: adapter.newChatUrl, active: true });
  await waitForTabComplete(tab.id);
  return tab.id;
}

// Max chars per chat message before we split the transcript across parts.
// ponytail: char budget, not a real tokenizer. Lower it if long videos still overflow.
const MAX_CHARS = 12000;

function chunkText(text, max) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    let end = Math.min(i + max, text.length);
    if (end < text.length) {
      const sp = text.lastIndexOf(" ", end); // don't cut mid-word
      if (sp > i) end = sp;
    }
    chunks.push(text.slice(i, end).trim());
    i = end;
  }
  return chunks.filter(Boolean);
}

// One message for short transcripts; chunks + a final summarize prompt for long ones.
function buildMessages(template, title, transcript) {
  const filled = template.replace("{title}", title);
  if (transcript.length <= MAX_CHARS) {
    return [filled.replace("{transcript}", transcript)];
  }
  const chunks = chunkText(transcript, MAX_CHARS);
  const parts = chunks.map(
    (c, i) =>
      `Transcript part ${i + 1} of ${chunks.length}. Reply only "OK" — do not summarize yet.\n\n${c}`
  );
  parts.push(
    filled.replace("{transcript}", "(the full transcript, pasted above across the parts)")
  );
  return parts;
}

async function summarize() {
  const [ytTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!ytTab || !/youtube\.com/.test(ytTab.url || ""))
    throw new Error("Open a YouTube video tab first.");

  const videoId = new URL(ytTab.url).searchParams.get("v");
  if (!videoId) throw new Error("No ?v= video id in the active tab.");

  const transcript = await fetchTranscript(videoId);
  const title = (ytTab.title || "").replace(/ - YouTube$/, "") || videoId;

  const cfg = await getConfig();
  const adapter = self.PROVIDERS.chatgpt;

  const messages = buildMessages(cfg.promptTemplate, title, transcript);

  const provTabId = await openProviderTab(adapter);

  // Drive the loop here, one message per sendToTab call. Each call returns in
  // ~a minute, which resets the service worker's idle timer — a single call
  // spanning every chunk gets the worker killed around the 5-minute mark.
  let last = "";
  for (let i = 0; i < messages.length; i++) {
    console.log(`[summarizer] sending part ${i + 1}/${messages.length}`);
    const r = await sendToTab(provTabId, {
      type: "RUN_PROMPT",
      provider: adapter.id,
      text: messages[i]
    });
    if (!r?.ok)
      throw new Error(`Part ${i + 1}/${messages.length}: ${r?.error || "provider failed."}`);
    last = r.text;
  }

  return { summary: last, title, provider: adapter.label };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "SUMMARIZE") return;
  summarize()
    .then(data => sendResponse({ ok: true, data }))
    .catch(err => sendResponse({ ok: false, error: String(err.message || err) }));
  return true; // async
});
