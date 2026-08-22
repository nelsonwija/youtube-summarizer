const DEFAULT_TEMPLATE =
  "Summarize this YouTube video from its transcript. Give a short overview then key points as bullets.\n\nTitle: {title}\n\nTranscript:\n{transcript}";

const templateEl = document.getElementById("template");
const savedEl = document.getElementById("saved");

chrome.storage.sync.get({ promptTemplate: DEFAULT_TEMPLATE }, cfg => {
  templateEl.value = cfg.promptTemplate;
});

document.getElementById("save").addEventListener("click", () => {
  chrome.storage.sync.set(
    { promptTemplate: templateEl.value.trim() || DEFAULT_TEMPLATE },
    () => {
      savedEl.textContent = "Saved ✓";
      setTimeout(() => (savedEl.textContent = ""), 1500);
    }
  );
});
