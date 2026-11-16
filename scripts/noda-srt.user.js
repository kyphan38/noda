// ==UserScript==
// @name         noda: download YouTube subtitles as .srt
// @namespace    noda
// @version      0.1
// @description  Adds a "noda .srt" button on youtube.com watch pages. Downloads the English subtitles the channel uploaded (not auto captions) as an .srt file that noda accepts.
// @match        https://www.youtube.com/*
// @match        https://m.youtube.com/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // YouTube's caption URL needs a PO token that only the player can make, and the token
  // is tied to the video. So we never build the request ourselves: we turn the track on
  // in the player and keep a copy of the player's own response.
  const captured = new Map(); // "videoId|lang" -> json3 text

  function remember(url, text) {
    try {
      const u = new URL(url, location.href);
      if (!u.pathname.includes('/api/timedtext') || !text) return;
      if (u.searchParams.get('kind') === 'asr') return;
      captured.set(u.searchParams.get('v') + '|' + u.searchParams.get('lang'), text);
    } catch {}
  }

  const open = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    if (String(url).includes('/api/timedtext')) {
      this.addEventListener('load', () => remember(String(url), this.responseText));
    }
    return open.call(this, method, url, ...rest);
  };
  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    const url = typeof args[0] === 'string' ? args[0] : args[0] && args[0].url;
    if (url && url.includes('/api/timedtext')) res.clone().text().then((t) => remember(url, t)).catch(() => {});
    return res;
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const ts = (ms) => {
    ms = Math.max(0, Math.round(ms));
    return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)},${pad(ms % 1000, 3)}`;
  };

  function json3ToSrt(json) {
    const out = [];
    for (const e of json.events || []) {
      if (!e.segs || e.dDurationMs == null) continue;
      const text = e.segs.map((s) => s.utf8).join('').replace(/\s*\n\s*/g, ' ').trim();
      if (!text) continue;
      out.push(`${out.length + 1}\n${ts(e.tStartMs)} --> ${ts(e.tStartMs + e.dDurationMs)}\n${text}\n`);
    }
    return out.join('\n');
  }

  /** Uploaded English track: exact "en" first, then en-GB / en-US / any en-*. Never asr. */
  function pickTrack(tracks) {
    const en = tracks.filter((t) => t.kind !== 'asr' && /^en(-|$)/i.test(t.languageCode));
    return en.find((t) => t.languageCode === 'en') || en[0] || null;
  }

  async function waitFor(key, ms) {
    for (let i = 0; i < ms / 200; i++) {
      if (captured.has(key)) return captured.get(key);
      await sleep(200);
    }
    return null;
  }

  async function run(button) {
    const player = document.querySelector('#movie_player');
    if (!player || !player.getPlayerResponse) return alert('noda: player not found.');
    const res = player.getPlayerResponse();
    const id = res && res.videoDetails && res.videoDetails.videoId;
    const title = (res && res.videoDetails && res.videoDetails.title) || id;
    const tracks = (res && res.captions && res.captions.playerCaptionsTracklistRenderer &&
      res.captions.playerCaptionsTracklistRenderer.captionTracks) || [];
    const track = pickTrack(tracks);
    if (!track) return alert('noda: this video has no English subtitles from the channel (auto captions do not count).');

    const key = id + '|' + track.languageCode;
    button.textContent = 'noda .srt …';
    if (player.classList.contains('ad-showing')) {
      button.textContent = 'noda: wait for the ad…';
      while (player.classList.contains('ad-showing')) await sleep(500);
    }
    let text = captured.get(key);
    if (!text) {
      const before = player.getOption('captions', 'track');
      player.loadModule('captions');
      player.setOption('captions', 'track', { languageCode: track.languageCode });
      text = await waitFor(key, 5000);
      if (!text) {
        // Track was loaded before this script hooked in: reload the module to make the player fetch again.
        player.unloadModule('captions');
        player.loadModule('captions');
        player.setOption('captions', 'track', { languageCode: track.languageCode });
        text = await waitFor(key, 5000);
      }
      // Put the viewer's caption choice back.
      if (!before || !before.languageCode) player.unloadModule('captions');
      else player.setOption('captions', 'track', before);
    }
    button.textContent = 'noda .srt';
    if (!text) return alert('noda: could not read the subtitles. Press play once, then try again.');

    const srt = json3ToSrt(JSON.parse(text));
    const safe = title.replace(/[\\/:*?"<>|]/g, '').trim();
    // "[id]" lets noda check the file belongs to the video.
    const name = `${safe} [${id}].${track.languageCode}.srt`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([srt], { type: 'application/x-subrip' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  function addButton() {
    if (!location.pathname.startsWith('/watch')) return;
    if (document.getElementById('noda-srt-btn')) return;
    const b = document.createElement('button');
    b.id = 'noda-srt-btn';
    b.textContent = 'noda .srt';
    b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:99999;padding:10px 14px;border-radius:999px;border:0;background:#111;color:#fff;font:600 14px system-ui;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3)';
    b.onclick = () => run(b).catch((e) => { b.textContent = 'noda .srt'; alert('noda: ' + e.message); });
    document.body.appendChild(b);
  }

  // YouTube changes pages without reloading.
  window.addEventListener('yt-navigate-finish', addButton);
  document.addEventListener('DOMContentLoaded', addButton);
  window.__nodaSrt = { run, captured, json3ToSrt }; // for testing
})();
