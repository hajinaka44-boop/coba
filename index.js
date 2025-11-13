/**

 * 🔥 DRIX-ALEXA PROJECT - PANEL ALL IN ONE ==

 * ==========================================

 * ✅ Fix Eror / Gagal Membaca Pesan

 * ✅ Deteksi negara dari prefix kode

 * ✅ Nama apk otomatis tebaca dari aray data

 * ✅ Anti Duplikat (10detik wajib)

 * ✅ Log Ringkas + Anti Spam

 * ✅ Tombol ADMIN + CHANNEL (Optional)

 * ✅ Sembunyikan 3 angka dari nomor

 * ✅ HTML Fallback (Cloudflare Bypass)

 * ==========================================

 * WORK ON: IMS - AITELCO - XISORA - PURPLENUMBER

 */

const fs = require("fs");

const path = require("path");

const axios = require("axios");

const cloudscraper = require("cloudscraper");

const { chromium } = require("playwright-extra");

const stealth = require("puppeteer-extra-plugin-stealth")();

chromium.use(stealth);

// ========== CONFIG ==========

const TELEGRAM_TOKEN = "8435061:AAFXw7VjAqk8GD3iUGDeM38t2bsJJzQxj5Q";

const TELEGRAM_CHAT_ID = "-1003200533486";

const BASE_URL = "https://imssms.org/client";

const FIXED_ENDPOINT = `${BASE_URL}/res/data_smscdr.php`;

const DT_ENDPOINT = `${BASE_URL}/ajax/dt_reports.php`; // fallback JSON

const HTML_FALLBACK_URL = "https://d-group.stats.direct/sms-records/index";

const COOKIE_FILE = path.join(__dirname, ".cookie");

const LAST_ID_FILE = path.join(__dirname, "last_id.json");

const CHECK_INTERVAL_MS = 10000;

// ========== VARIABEL GLOBAL ==========

let lastId = null;

let isFirstRun = true;

let usedEndpoint = null;

let lastLogTime = 0;

let playwrightRetryCount = 0;

// ========== LOGGER ==========

const _L = { last: null, time: 0, repeats: 0, window: 8000 };

function _flushRepeats() {

  if (_L.repeats > 0) console.log(`…(berulang ${_L.repeats}x)`), (_L.repeats = 0);

}

function logInfo(msg) {

  const now = Date.now();

  if (msg === _L.last && now - _L.time < _L.window) return _L.repeats++;

  _flushRepeats();

  _L.last = msg; _L.time = now;

  console.log(msg);

}

function logWarn(msg) { _flushRepeats(); console.log("⚠️ " + msg); }

function logError(msg) { _flushRepeats(); console.error("❌ " + msg); }

process.on("exit", _flushRepeats);

process.on("SIGINT", () => { _flushRepeats(); process.exit(); });

process.on("SIGTERM", () => { _flushRepeats(); process.exit(); });

let lastNoMsgLog = 0;

const NO_MSG_LOG_INTERVAL = 30 * 1000;

function logNoMessage() {

  const now = Date.now();

  if (now - lastNoMsgLog >= NO_MSG_LOG_INTERVAL) {

    logInfo("⏳ Tidak ada pesan baru...");

    lastNoMsgLog = now;

  }

}

// ========== UTIL ==========

function todayRange() {

  const now = new Date();

  const pad = (n) => n.toString().padStart(2, "0");

  return {

    start: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 00:00:00`,

    end: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} 23:59:59`,

  };

}

function loadCookieHeader() {

  try {

    const jsonPath = path.join(__dirname, "cookies.json");

    const txtPath = path.join(__dirname, ".cookie");

    // 🔹 1. Cek cookies.json

    if (fs.existsSync(jsonPath)) {

      const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

      if (Array.isArray(data)) {

        // Ambil semua cookie valid untuk domain d-group / stats.direct

        const pairs = data

          .filter(c =>

            c &&

            c.name &&

            c.value &&

            (c.domain.includes("d-group.stats.direct") || c.domain.includes("stats.direct"))

          )

          .map(c => `${c.name}=${c.value}`);

        if (pairs.length > 0) {

          logInfo(`🍪 ${pairs.length} cookie termuat dari cookies.json`);

          return pairs.join("; ");

        } else {

          logWarn("⚠️ Tidak ada cookie cocok dengan domain d-group.stats.direct");

        }

      }

    }

    // 🔹 2. Fallback: .cookie biasa

    if (fs.existsSync(txtPath)) {

      const raw = fs.readFileSync(txtPath, "utf8").trim();

      if (raw.includes("=")) return raw;

      return `PHPSESSID=${raw}`;

    }

    logWarn("❌ Tidak menemukan cookies.json atau .cookie");

    return null;

  } catch (err) {

    logWarn("Gagal baca cookies: " + err.message);

    return null;

  }

}

async function refreshCookiesWithPlaywright() {

  let browser = null;

  try {

    logInfo("🌐 Membuka browser stealth untuk bypass Cloudflare...");

    browser = await chromium.launch({

      headless: true,

      args: [

        '--disable-blink-features=AutomationControlled',

        '--no-sandbox',

        '--disable-dev-shm-usage',

        '--disable-gpu'

      ]

    });

    const context = await browser.newContext({

      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",

      viewport: { width: 1920, height: 1080 },

      locale: 'en-US',

      timezoneId: 'America/New_York',

      extraHTTPHeaders: {

        'Accept-Language': 'en-US,en;q=0.9,id;q=0.8',

        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',

        'Accept-Encoding': 'gzip, deflate, br',

        'Connection': 'keep-alive',

        'Upgrade-Insecure-Requests': '1'

      }

    });

    const page = await context.newPage();

    await page.goto("https://d-group.stats.direct/sms-records/index", {

      waitUntil: "domcontentloaded",

      timeout: 60000

    });

    await page.mouse.move(100 + Math.random() * 100, 100 + Math.random() * 100);

    await page.waitForTimeout(5000);

    let pageContent = await page.content();

    if (pageContent.includes("Just a moment") || pageContent.includes("cloudflare") || pageContent.includes("challenge")) {

      logInfo("⏳ Menunggu Cloudflare challenge selesai (30s)...");

      await page.waitForTimeout(30000);

      pageContent = await page.content();

      if (pageContent.includes("Just a moment") || pageContent.includes("challenge")) {

        logWarn("⚠️ Cloudflare challenge masih ada, tunggu lebih lama...");

        await page.waitForTimeout(20000);

      }

    }

    await page.mouse.move(200 + Math.random() * 100, 200 + Math.random() * 100);

    await page.waitForTimeout(2000);

    const cookies = await context.cookies();

    if (cookies && cookies.length > 0) {

      const relevantCookies = cookies.filter(c =>

        c.domain.includes("stats.direct") &&

        (c.name.includes("cf_") || c.name.includes("advanced") || c.name.includes("csrf") || c.name.includes("__cflb"))

      );

      if (relevantCookies.length > 0) {

        fs.writeFileSync(

          path.join(__dirname, "cookies.json"),

          JSON.stringify(cookies, null, 2),

          "utf8"

        );

        logInfo(`✅ ${relevantCookies.length} cookie penting disimpan!`);

        await browser.close();

        return cookies.filter(c => c.domain.includes("stats.direct"))

          .map(c => `${c.name}=${c.value}`).join("; ");

      }

    }

    logWarn("⚠️ Tidak ada cookie relevant didapat dari Playwright");

    await browser.close();

    return null;

  } catch (err) {

    if (browser) await browser.close().catch(() => {});

    logWarn("❌ Playwright gagal: " + err.message);

    return null;

  }

}

function loadLastId() {

  try {

    return JSON.parse(fs.readFileSync(LAST_ID_FILE, "utf8")).lastId || null;

  } catch { return null; }

}

function saveLastId(id) {

  try { fs.writeFileSync(LAST_ID_FILE, JSON.stringify({ lastId: id }), "utf8"); } catch {}

}

// ========== HELPER ==========

function maskNumber(num) {

  const s = String(num || "");

  if (s.length <= 6) return `${s.slice(0, 2)}***${s.slice(-2)}`;

  if (s.length <= 10) return `${s.slice(0, 4)}***${s.slice(-3)}`;

  return `${s.slice(0, 6)}***${s.slice(-3)}`;

}

function detectOTP(text) {

  if (!text) return "";

  let m = text.match(/\b(\d{3,4}[- ]?\d{3,4})\b/);

  if (m) return m[1].replace(/[-\s]/g, "");

  m = text.match(/\b(\d{4,8})\b/);

  return m ? m[1] : "";

}

// ========== COUNTRY ==========

const COUNTRY_CODES = {

  62:"Indonesia 🇮🇩",60:"Malaysia 🇲🇾",65:"Singapore 🇸🇬",91:"India 🇮🇳",84:"Vietnam 🇻🇳",

  55:"Brazil 🇧🇷",1:"USA 🇺🇸",44:"UK 🇬🇧",33:"France 🇫🇷",49:"Germany 🇩🇪",977:"Nepal 🇳🇵",

  7:"Russia 🇷🇺",92:"Pakistan 🇵🇰",234:"Nigeria 🇳🇬",254:"Kenya 🇰🇪",213:"Algeria 🇩🇿",249:"Sudan 🇸🇩",20:"Egypt 🇪🇬",972:"Isriwil 💩"

};

function extractCountry(text, number = "") {

  const num = String(number || "").replace(/\D/g, "");

  for (const [code, name] of Object.entries(COUNTRY_CODES))

    if (num.startsWith(code)) return name;

  const clean = String(text || "").trim();

  for (const [code, name] of Object.entries(COUNTRY_CODES))

    if (clean.toLowerCase().includes(name.split(" ")[0].toLowerCase())) return name;

  return `${clean} 🌍`;

}

// ========== TELEGRAM ==========

function escapeHTML(str = "") {

  return String(str)

    .replace(/&/g, "&amp;").replace(/</g, "&lt;")

    .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

}

function buildTelegramMessage(data) {

  const flagMatch = data.country.match(/[\u{1F1E6}-\u{1F1FF}]{2}/u);

  const flag = flagMatch ? flagMatch[0] : "🌍";

  const countryName = data.country.split(" ")[0];

  return [

    `🎉 <b>${flag} ${countryName} ${escapeHTML(data.application || "App")} Received!</b>`,

    "──────────────────────",

    `🌍 <b>Negara:</b> ${escapeHTML(data.country)}`,

    `📱 <b>Aplikasi:</b> ${escapeHTML(data.application)}`,

    `📞 <b>Nomor:</b> <code>${escapeHTML(maskNumber(data.number))}</code>`,

    `🔑 <b>OTP:</b> <code>${escapeHTML(data.otp || "N/A")}</code>`,

    "",

    `💬 <b>Pesan:</b>\n<pre>${escapeHTML(data.message || "—")}</pre>`,

    "──────────────────────",

    "⚡ by <b>DRIXALEXA</b> ⚡",

  ].join("\n");

}

async function sendToTelegram(text) {

  try {

    await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {

      chat_id: TELEGRAM_CHAT_ID,

      text,

      parse_mode: "HTML",

      reply_markup: {

        inline_keyboard: [[

          { text: "👑 ADMIN", url: "https://t.me/protcp" },

          { text: "📢 CHANNEL", url: "https://t.me/whatsappnokos" }

        ]]

      }

    });

    logInfo("✅ Terkirim ke Telegram");

  } catch (e) {

    logWarn("Gagal kirim Telegram: " + e.message);

  }

}

// ========== FETCH ==========

async function fetchFromEndpoint(endpoint, cookieHeader, start, end) {

  const url = `${endpoint}?fdate1=${encodeURIComponent(start)}&fdate2=${encodeURIComponent(end)}`;

  const res = await axios.get(url, {

    timeout: 10000,

    headers: {

      Cookie: cookieHeader, "User-Agent": "Mozilla/5.0",

      Accept: "application/json", "X-Requested-With": "XMLHttpRequest"

    },

    validateStatus: null,

  });

  const data = res.data;

  if (Array.isArray(data)) return data;

  if (Array.isArray(data["aa Data"])) return data["aa Data"];

  if (Array.isArray(data.aaData)) return data.aaData;

  if (Array.isArray(data.data)) return data.data;

  return [];

}

// ===== Playwright-based fetch (full bypass) =====

async function fetchFromHTMLWithPlaywright() {

  let browser = null;

  try {

    logInfo("🌐 Menggunakan Playwright untuk fetch data...");

    browser = await chromium.launch({

      headless: true,

      args: ['--disable-blink-features=AutomationControlled', '--no-sandbox', '--disable-dev-shm-usage']

    });

    const context = await browser.newContext({

      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36",

      viewport: { width: 1920, height: 1080 }

    });

    const page = await context.newPage();

    await page.goto("https://d-group.stats.direct/sms-records/index", { waitUntil: "load", timeout: 30000 });

    logInfo("⏳ Tunggu Cloudflare JS challenge (15s)...");

    await page.waitForTimeout(15000);

    let html = await page.content();

    if (html.includes("Just a moment") || html.includes("challenge-platform")) {

      logInfo("⏳ Challenge masih aktif, tunggu 30s lagi...");

      await page.waitForTimeout(30000);

      html = await page.content();

    }

    try {

      await page.waitForSelector("table", { timeout: 10000 });

      logInfo("✅ Tabel ditemukan! Mengambil data...");

    } catch {

      logInfo("⏳ Tidak ada tabel terdeteksi. Cek HTML untuk diagnosa.");

    }

    html = await page.content();

    fs.writeFileSync(path.join(__dirname, "playwright_debug.html"), html, "utf8");

    logInfo("📝 HTML disimpan ke playwright_debug.html untuk diagnosa.");

    await browser.close();

    if (html && (html.includes("<table") || html.includes("<tr"))) {

      logInfo("✅ Berhasil fetch HTML dengan Playwright!");

      return extractFromHTML(html);

    }

    if (html.toLowerCase().includes("login") || html.toLowerCase().includes("sign in")) {

      logWarn("⚠️ Website memerlukan login! Cookie session mungkin sudah expired.");

      return [];

    }

    logInfo("ℹ️ Halaman dimuat tapi tidak ada tabel/data SMS.");

    return [];

  } catch (err) {

    if (browser) await browser.close().catch(() => {});

    logWarn("❌ Playwright fetch gagal: " + err.message);

    return [];

  }

}

// ===== Robust HTML fetch + parser (replace your old fetchFromHTML + extractFromHTML) =====

async function fetchFromHTML() {

  const tryUrls = Array.from(new Set([

    HTML_FALLBACK_URL,

    HTML_FALLBACK_URL.replace(/\/index$/, "/ticker"),

    HTML_FALLBACK_URL.replace(/\/index$/, "/records"),

    HTML_FALLBACK_URL.replace(/sms-records\/index$/, "sms-records/ticker")

  ].filter(Boolean)));

  const cookieHeader = loadCookieHeader();

  if (!cookieHeader) {

    logInfo("🚀 Tidak ada cookie, langsung pakai Playwright...");

    return await fetchFromHTMLWithPlaywright();

  }

  for (const url of tryUrls) {

    try {

      logInfo(`🌐 HTML fallback: mencoba ${url}`);

      const html = await cloudscraper.get({

        uri: url,

        headers: {

          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",

          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",

          "Accept-Language": "en-US,en;q=0.9,id;q=0.8",

          "Accept-Encoding": "gzip, deflate, br",

          "Referer": "https://d-group.stats.direct/",

          "Connection": "keep-alive",

          "Upgrade-Insecure-Requests": "1",

          "Sec-Fetch-Dest": "document",

          "Sec-Fetch-Mode": "navigate",

          "Sec-Fetch-Site": "same-origin",

          "Sec-Fetch-User": "?1",

          "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',

          "sec-ch-ua-mobile": "?0",

          "sec-ch-ua-platform": '"Windows"',

          "Cookie": cookieHeader

        },

        timeout: 20000,

        simple: false,

        resolveWithFullResponse: false,

        cloudflareTimeout: 30000,

        cloudflareMaxTimeout: 60000

      });

      if (!html || html.length < 200) {

        logWarn(`⚠️ HTML kosong dari ${url} (len=${html ? html.length : 0})`);

        continue;

      }

      // Quick checks for common blocking/login pages

      const low = html.slice(0, 400).toLowerCase();

      if (low.includes("just a moment") || low.includes("cloudflare") || low.includes("challenge")) {

        logWarn("⚠️ Terdeteksi Cloudflare challenge! Menggunakan Playwright untuk bypass...");

        return await fetchFromHTMLWithPlaywright();

      }

      if (low.includes("login") || low.includes("sign in") || low.includes("csrf")) {

        logWarn("⚠️ Terdeteksi halaman login — kemungkinan cookie expired.");

      }

      const parsed = extractFromHTML(html);

      logInfo(`📊 Parsed ${parsed.length} baris dari HTML (${url}).`);

      if (parsed && parsed.length > 0) return parsed;

      // jika parsed 0, lanjut ke URL fallback berikutnya

    } catch (err) {

      logWarn(`❌ Gagal fetch HTML ${url}: ${err && err.message || err}`);

      // lanjut next url

    }

  }

  // semua coba gagal

  logWarn("⚠️ Semua HTML fallback dicoba, tapi tidak ada data.");

  return [];

}

/**

 * Robust parser: map kolom berdasarkan data-col-seq (lebih fleksibel)

 * - cari semua <tr>... lalu untuk setiap <td ... data-col-seq="N"> ambil N -> text

 * - ambil kandidat kolom umum: waktu(0), app(3/5), number(4/6/2), message(5/7/12/last)

 */

function extractFromHTML(html) {

  try {

    if (!html || typeof html !== "string") return [];

    const rowMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

    const result = [];

    for (const r of rowMatches) {

      const rowHtml = r[1];

      // find all td with optional data-col-seq

      const tdMatches = [...rowHtml.matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];

      if (!tdMatches || tdMatches.length === 0) continue;

      // build map colseq -> text (if data-col-seq exists), or push into array if none

      const colsByIndex = {}; // colseq -> text

      const fallbackCols = []; // order-based fallback

      for (const m of tdMatches) {

        const attrs = m[1];

        let inner = m[2] || "";

        // strip tags and decode some entities (basic)

        inner = inner.replace(/<[^>]+>/g, "");

        inner = inner.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/&#039;/g, "'").replace(/&nbsp;/g, " ");

        inner = inner.replace(/\s+/g, " ").trim();

        const seqMatch = attrs.match(/data-col-seq=["']?(\d+)["']?/i);

        if (seqMatch) {

          colsByIndex[Number(seqMatch[1])] = inner;

        } else {

          fallbackCols.push(inner);

        }

      }

      // choose candidates from colsByIndex first, otherwise fallback to fallbackCols

      const pick = (arr) => {

        for (const k of arr) {

          if (colsByIndex.hasOwnProperty(k) && String(colsByIndex[k]).trim().length > 0) return colsByIndex[k];

        }

        // fallback: try common positions in fallbackCols

        for (const k of arr) {

          if (typeof k === "number" && fallbackCols[k] && fallbackCols[k].trim().length > 0) return fallbackCols[k];

        }

        return "";

      };

      // common column numbers used across variants

      const rawTime = pick([0, 1, 2]);

      const app = pick([5, 3, 1]);

      const number = pick([6, 4, 2, 3]);

      // message candidates: 12 (big table), 5 (ticker), 7, last

      let msg = pick([12, 5, 7, 4]);

      if ((!msg || msg.length < 3) && fallbackCols.length > 0) msg = fallbackCols[fallbackCols.length - 1] || msg;

      // cleanup msg (remove weird control chars)

      const cleanMsg = String(msg || "").replace(/[^\x20-\x7E\n\r]+/g, " ").replace(/\s+/g, " ").trim();

      // validations

      if (!number || !cleanMsg || cleanMsg.length < 5) continue;

      if (!/\d/.test(number)) continue; // require at least a digit in number

      const id = `${number}_${rawTime || Date.now()}`;

      const otp = detectOTP(cleanMsg);

      result.push({

        id,

        rawTime: rawTime || "",

        application: (app || "").trim() || "Unknown",

        number: number.trim(),

        message: cleanMsg,

        otp,

        country: extractCountry(app || "", number || "")

      });

    }

    // sort by time if available (otherwise keep order)

    try {

      result.sort((a, b) => {

        const ta = Date.parse(a.rawTime) || 0;

        const tb = Date.parse(b.rawTime) || 0;

        return ta - tb;

      });

    } catch (e) {}

    return result;

  } catch (e) {

    logWarn("Parser HTML error: " + (e && e.message || e));

    return [];

  }

}

// ========== MAIN CHECK ==========

async function checkForMessage() {

  try {

    const cookieHeader = loadCookieHeader();

    if (!cookieHeader) return logWarn("Cookie tidak ditemukan!");

    const { start, end } = todayRange();

    let arr = [];

    // ambil data (sama seperti sebelumnya, coba JSON lalu HTML)

    if (!usedEndpoint) {

      const ENDPOINTS = [FIXED_ENDPOINT, DT_ENDPOINT];

      for (const ep of ENDPOINTS) {

        try {

          arr = await fetchFromEndpoint(ep, cookieHeader, start, end);

          if (arr && arr.length > 0) { usedEndpoint = ep; break; }

        } catch (err) {

          logWarn("Gagal ambil " + ep + ": " + (err && err.message || err));

        }

      }

      if (!usedEndpoint) {

        logWarn("JSON gagal — coba HTML fallback");

        arr = await fetchFromHTML();

        usedEndpoint = "HTML_FALLBACK";

      }

    } else {

      if (usedEndpoint === "HTML_FALLBACK") arr = await fetchFromHTML();

      else {

        try {

          arr = await fetchFromEndpoint(usedEndpoint, cookieHeader, start, end);

          if (!arr || arr.length === 0) {

            // reset supaya next tick akan re-detect endpoint

            logWarn(`Endpoint ${usedEndpoint} kosong — reset endpoint.`);

            usedEndpoint = null;

          }

        } catch (err) {

          logWarn(`Gagal ambil dari ${usedEndpoint}: ${err && err.message || err}`);

          usedEndpoint = null;

        }

      }

    }

    if (!arr || arr.length === 0) return logNoMessage();

    // Debug kecil (hapus/komentari kalau sudah oke)

    // console.log("📦 Contoh data hasil endpoint (3):", JSON.stringify(arr.slice(0,3), null, 2));

    // Normalizer: ubah setiap item ke bentuk { id, number, application, message, otp, country }

    const normalized = [];

    for (const item of arr) {

      try {

        if (Array.isArray(item)) {

          // KHUSUS: format yang kamu kirim punya message di index 7, number di 2, app di 3, country/label di 1

          // tapi kita tetap fleksibel: cek keberadaan index

          const time = item[0] || "";

          const label = item[1] || "";

          const number = (item[2] || "").toString().trim();

          const application = item[3] || "";

          // pesan bisa berada di index 4,5,6,7 tergantung panel; prioritas 7 -> 4 -> last

          const messageCandidates = [item[7], item[4], item[5], item[6], item[item.length - 1]];

          const message = (messageCandidates.find(m => m && String(m).trim().length > 0) || "").toString();

          const id = item.id || `${number}_${time || application || Math.random().toString(36).slice(2,8)}`;

          // Filter: valid number (not "0", not empty), and message contains at least a digit (likely OTP)

          const isValidNumber = number && !/^0+$/.test(number) && /[0-9]/.test(number);

          const isValidMessage = message && message.trim().length > 0;

          if (!isValidNumber || !isValidMessage) {

            // skip footer / summary rows like ['0,0,0,1', 0, 0, 0, ...]

            continue;

          }

          normalized.push({

            id,

            number,

            application: application || label || "Unknown",

            message,

            otp: detectOTP(message || ""),

            country: extractCountry(label || application, number)

          });

        } else if (item && typeof item === "object") {

          // object-shaped row

          const id = item.id || `${item.number || ""}_${item.application || ""}`;

          const number = (item.number || "").toString().trim();

          const message = (item.message || item.msg || item.text || "").toString();

          if (!number || /^0+$/.test(number) || !message) continue;

          normalized.push({

            id,

            number,

            application: item.application || item.app || "Unknown",

            message,

            otp: detectOTP(message),

            country: extractCountry(item.application || "", number)

          });

        } // else ignore other types

      } catch (e) {

        // jangan crash, teruskan ke item berikutnya

        logWarn("Normalize item error: " + (e && e.message || e));

        continue;

      }

    }

    if (!normalized || normalized.length === 0) return logNoMessage();

    // Urutkan berdasarkan id/time jika perlu (opsional)

    // jika id berisi timestamp di depan, urutkan; jika tidak, tetap gunakan urutan asli

    // ambil yang paling akhir (terbaru)

    const latest = normalized[normalized.length - 1];

    if (!latest || !latest.id) return logWarn("❌ Data kosong/invalid!");

    if (latest.id === lastId) return logNoMessage();

    // Kirim dan simpan lastId

    logInfo(`📩 Pesan baru: ${latest.application} | +${latest.number} | OTP:${latest.otp || "N/A"}`);

    await sendToTelegram(buildTelegramMessage(latest));

    lastId = latest.id;

    saveLastId(lastId);

  } catch (err) {

    logError("ERROR: " + (err && err.message || err));

  }

}

// ========== START ==========

(async () => {

  logInfo(`🚀 Bot aktif – cek pesan setiap ${CHECK_INTERVAL_MS / 1000}s...`);

  lastId = loadLastId();

  await checkForMessage();

  setInterval(checkForMessage, CHECK_INTERVAL_MS);

})();