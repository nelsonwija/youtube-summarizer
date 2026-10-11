# YouTube Transcript Summarizer

A Chrome extension that summarizes the YouTube video you are watching.

It gets the video's transcript, pastes it into ChatGPT for you, and shows
ChatGPT's summary in a small popup. It uses your normal ChatGPT login, so you
don't need an API key.

## How it works

1. You click the extension button on a YouTube video.
2. A small Python server on your computer gets the video's transcript.
3. The extension opens a ChatGPT temporary chat, which isn't saved to your
   history.
4. It pastes the transcript in, sends it, and waits for the answer.
5. The summary shows up in the popup.

Long videos are sent in parts. ChatGPT replies "OK" to each part, then writes
the summary at the end.

## What you need

- Google Chrome
- Python 3
- A ChatGPT account, logged in to chatgpt.com in Chrome

## Setup

### 1. Start the transcript server

```bash
cd server
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/python server.py
```

The server runs at `http://localhost:8791`. Keep it running while you use the
extension.

### 2. Add the extension to Chrome

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and pick the `extension/` folder.

## How to use it

1. Open a YouTube video that has captions.
2. Click the extension button, then click **Summarize this video**.
3. Keep the popup open until the summary shows up. If you close it, you lose
   the result.

To change what you ask ChatGPT, click the ⚙ in the popup to open the **Options** page. In
your prompt, `{title}` is replaced with the video title and `{transcript}`
with the transcript.

## Optional: start the server automatically (macOS)

You can have the server start every time you log in, and restart if it
crashes.

1. Open `server/com.iamnewie.youtube-summarizer.plist` and change every
   `/Users/user/Projects/youtube-summarizer` path to where this folder is on
   your computer.
2. Run:

```bash
cp server/com.iamnewie.youtube-summarizer.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.iamnewie.youtube-summarizer.plist
```

Useful commands:

```bash
launchctl print gui/$(id -u)/com.iamnewie.youtube-summarizer          # check it's running
launchctl kickstart -k gui/$(id -u)/com.iamnewie.youtube-summarizer   # restart it
launchctl bootout gui/$(id -u)/com.iamnewie.youtube-summarizer        # stop and remove it
```

The server writes its logs to `server/server.log`.

## Project files

```
server/
  server.py              the transcript server
  requirements.txt       Python packages it needs
  com.iamnewie...plist   macOS auto-start file (optional)
extension/
  manifest.json          extension settings
  background.js          runs the whole process
  providers.js           how to find things on the ChatGPT page
  content/provider.js    types into ChatGPT and reads the answer
  popup.html / .js       the popup you click
  options.html / .js     the page where you edit the prompt
```

## If something breaks

- **"Transcript server not reachable"**: the Python server isn't running.
  Start it (see Setup step 1).
- **Nothing gets typed, the message isn't sent, or the answer is never
  read**: ChatGPT probably changed its page. Update the selectors in
  `extension/providers.js`. That's the only file you need to change. Then
  reload the extension on `chrome://extensions`.
- **No transcript**: the video needs captions. If YouTube blocks your
  server, see the
  [youtube-transcript-api](https://github.com/jdepoix/youtube-transcript-api)
  docs on using proxies.
- **"Content Security Policy" errors in the ChatGPT tab's console**: these
  come from ChatGPT itself. You can ignore them.

## Please note

- This extension controls the ChatGPT website for you. That may go against
  ChatGPT's terms of use, so use it at your own risk.
- It can stop working whenever ChatGPT changes its website.
