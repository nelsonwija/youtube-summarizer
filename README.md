# YouTube Transcript Summarizer

Chrome extension (Manifest V3) + tiny local Python server. Click the toolbar
icon on a YouTube video → the server fetches the transcript via
[youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api),
the extension drives your **already-logged-in ChatGPT** in a temporary chat
(types the prompt, submits, scrapes the reply), and shows the summary in the
popup. **No LLM API keys.**

## Layout
```
server/      transcript server (Python) — standalone, talks HTTP on :8791
extension/   Chrome extension (MV3) — load this folder unpacked
```
The two only meet over `http://localhost:8791`; neither reads the other's files.

## 1. Start the transcript server
```bash
cd server
python -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python server.py        # serves http://localhost:8791
```
Leave it running while you use the extension.

### Run it as a login service (macOS launchd)
So it auto-starts at every login and restarts if it crashes:
```bash
cp server/com.iamnewie.youtube-summarizer.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.iamnewie.youtube-summarizer.plist
```
Manage it:
```bash
launchctl print  gui/$(id -u)/com.iamnewie.youtube-summarizer   # status
launchctl kickstart -k gui/$(id -u)/com.iamnewie.youtube-summarizer  # restart (after code changes)
launchctl bootout gui/$(id -u)/com.iamnewie.youtube-summarizer   # stop + uninstall
```
Logs → `server/server.log`. The plist holds absolute paths — if you move the
project folder, edit them and re-bootstrap.

## 2. Install the extension (load unpacked)
1. Go to `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. **Load unpacked** → select the `extension/` folder.
4. Log in to `chatgpt.com` in the same browser.

## Use
1. Open a YouTube video that has captions.
2. Click the extension icon → **Summarize this video**.
3. Keep the popup open — it opens a ChatGPT **temporary chat**, waits for the
   reply, then shows the summary. Edit the prompt in **⚙ Options**.

## How it works
- `server/server.py` — local HTTP server (port 8791); `GET /transcript?v=<id>`
  returns the transcript via youtube-transcript-api (handles YouTube's
  token/consent stuff server-side, which the browser can't).
- `extension/background.js` — calls `localhost:8791`, opens the ChatGPT
  temporary-chat tab, feeds it the transcript, relays the reply to the popup.
- `extension/providers.js` — ChatGPT selectors (input, send, reply,
  generating-indicator). **The only file to edit when ChatGPT changes its DOM.**
- `extension/content/provider.js` — types the prompt, clicks send, waits for
  streaming to finish, returns the last reply.

## Known limits / caveats
- **Server must be running** — the extension errors clearly if not.
- **LLM part is brittle & against ChatGPT ToS.** Web-UI automation breaks when
  ChatGPT changes its markup — fix by updating selectors in `providers.js`.
- Popup must stay open during the run (closing it drops the result).
- Video must have captions. If YouTube IP-blocks the server, the lib supports
  proxies (see its README) — wire `WebshareProxyConfig` into `server/server.py`.

## Future (not built): API-key mode
Add an adapter that calls the OpenAI REST API directly (supports CORS from the
browser). More robust, but needs a key. Would slot in beside
`extension/providers.js`.
