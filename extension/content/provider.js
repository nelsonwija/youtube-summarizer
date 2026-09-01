// Runs on chatgpt.com. Types a prompt, submits, waits for the
// streamed reply to finish, returns the text. Selectors come from providers.js.

function waitFor(selector, timeout = 20000) {
  return new Promise((resolve, reject) => {
    const found = document.querySelector(selector);
    if (found) return resolve(found);
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) {
        obs.disconnect();
        resolve(el);
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => {
      obs.disconnect();
      reject(new Error(`Timed out waiting for ${selector}`));
    }, timeout);
  });
}

function setInput(el, text) {
  el.focus();
  // contenteditable (ProseMirror) and <textarea> both handled.
  if (el.tagName === "TEXTAREA") {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    ).set;
    setter.call(el, text);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    // contenteditable: insertText so React/ProseMirror see a real edit
    document.execCommand("selectAll", false, null);
    document.execCommand("insertText", false, text);
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Wait for a NEW assistant reply whose text has been stable for stableMs and
// generation stopped. Watching text-stability (not just the stop button)
// survives fast "OK" replies the button check would miss.
// Keyed on the last node's IDENTITY, not the node count: ChatGPT unmounts older
// turns in long threads, so a count-based check stops growing and hangs forever.
function waitForNewReply(adapter, prevLast, stableMs = 1200, hardTimeout = 180000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    let lastText = "";
    let lastChange = Date.now();

    const tick = setInterval(() => {
      const res = document.querySelectorAll(adapter.responseSelector);
      const cur = res[res.length - 1] || null;
      const generating = !!document.querySelector(adapter.stopSelector);
      if (cur && cur !== prevLast) {
        const txt = cur.innerText;
        if (txt !== lastText) {
          lastText = txt;
          lastChange = Date.now();
        }
        if (!generating && txt && Date.now() - lastChange > stableMs) {
          clearInterval(tick);
          return resolve(txt.trim());
        }
      }
      if (Date.now() - start > hardTimeout) {
        clearInterval(tick);
        reject(new Error("Timed out waiting for the reply to finish."));
      }
    }, 300);
  });
}

// Send ONE message into the chat and return its reply. The background worker
// drives the loop — one short call per chunk keeps the MV3 service worker from
// being killed mid-run for sitting in a single multi-minute event.
async function runPrompt(adapter, text) {
  const input = await waitFor(adapter.inputSelector);
  const nodes = document.querySelectorAll(adapter.responseSelector);
  const prevLast = nodes[nodes.length - 1] || null;
  setInput(input, text);

  const send = await waitFor(adapter.sendSelector);
  await sleep(400); // let the UI enable the button after the input event
  send.click();

  const reply = await waitForNewReply(adapter, prevLast);
  if (!reply) throw new Error("Could not find the assistant reply.");
  return reply;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type !== "RUN_PROMPT") return;
  const adapter = self.PROVIDERS[msg.provider];
  if (!adapter) {
    sendResponse({ ok: false, error: `Unknown provider ${msg.provider}` });
    return;
  }
  runPrompt(adapter, msg.text)
    .then(text => sendResponse({ ok: true, text }))
    .catch(err => sendResponse({ ok: false, error: String(err.message || err) }));
  return true; // async
});
