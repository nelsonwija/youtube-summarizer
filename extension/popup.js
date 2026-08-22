const go = document.getElementById("go");
const status = document.getElementById("status");
const summary = document.getElementById("summary");

document.getElementById("gear").addEventListener("click", e => {
  e.preventDefault();
  chrome.runtime.openOptionsPage();
});

function setStatus(text, isErr) {
  status.textContent = text;
  status.className = isErr ? "err" : "";
}

go.addEventListener("click", () => {
  go.disabled = true;
  summary.textContent = "";
  setStatus("Reading transcript & driving provider tab… keep this popup open.");

  chrome.runtime.sendMessage({ type: "SUMMARIZE" }, res => {
    go.disabled = false;
    if (chrome.runtime.lastError) {
      setStatus(chrome.runtime.lastError.message, true);
      return;
    }
    if (!res?.ok) {
      setStatus(res?.error || "Something went wrong.", true);
      return;
    }
    setStatus(`Summary via ${res.data.provider}`);
    summary.textContent = res.data.summary;
  });
});
