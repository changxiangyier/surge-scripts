/*
多 AI 检测面板（重写版）
默认策略组：AI Suite

支持参数：
title=AI%20Suite
policy=AI%20Suite
timeout=8

可选图标参数：
icon=brain
icon-color=#4F46E5
iconwarn=exclamationmark.triangle
iconwarn-color=#F59E0B
iconerr=xmark.octagon.fill
iconerr-color=#EF4444
*/

const DEFAULT_POLICY = "AI Suite";
const TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace";

const GPT_SUPPORTED = [
  "T1","XX","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB","BE","BZ","BJ","BT","BO","BA",
  "BW","BR","BN","BG","BF","BI","CV","CA","CL","CO","KM","CG","CR","HR","CY","DK","DJ","DM","DO","EC","SV","EE",
  "FJ","FI","FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU","IS","IN","ID","IQ","IE",
  "IL","IT","JM","JP","JO","KZ","KE","KI","KW","KG","LV","LB","LS","LR","LI","LT","LU","MG","MW","MY","MV","ML",
  "MT","MH","MR","MU","MX","MC","MN","ME","MA","MZ","MM","NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM",
  "PK","PW","PA","PG","PE","PH","PL","PT","QA","RO","RW","KN","LC","VC","WS","SM","ST","SN","RS","SC","SL","SG",
  "SK","SI","SB","ZA","ES","LK","SR","SE","CH","TH","TG","TO","TT","TN","TR","TV","UG","AE","US","UY","VU","ZM",
  "AF","AR","AM","AW","AZ","BM","BQ","BV","IO","KY","CX","CC","CK","CW","FK","FO","GF","PF","TF","GI","GL","GP",
  "GG","VA","HK","IM","JE","MO","MQ","YT","MS","NC","NU","NF","MP","PS","PN","PR","RE","BL","SH","MF","PM","SX",
  "GS","SJ","TK","TC","UA","GB","UZ","VG","VI","WF","BO","CZ","FM","MD","PS","KR","TW","TZ","TL"
];

const SERVICES = [
  {
    key: "chatgpt",
    name: "ChatGPT",
    type: "gpt",
    url: "https://chatgpt.com/",
    okHints: ["chatgpt", "openai"],
    warnHints: [
      "checking your browser",
      "cf-chl",
      "access denied",
      "forbidden",
      "temporarily unavailable"
    ],
    unsupportedHints: [
      "unsupported country",
      "not available in your country"
    ]
  },
  {
    key: "gemini",
    name: "Gemini",
    type: "page",
    url: "https://gemini.google.com/",
    okHints: ["gemini", "google ai", "accounts.google.com"],
    warnHints: [
      "sign in",
      "unable to access",
      "verify",
      "forbidden"
    ],
    unsupportedHints: [
      "isn't currently supported in your country",
      "not available in your region",
      "unsupported country"
    ]
  },
  {
    key: "claude",
    name: "Claude",
    type: "page",
    url: "https://claude.ai/",
    okHints: ["claude", "anthropic"],
    warnHints: [
      "verify you are human",
      "checking if the site connection is secure",
      "access denied",
      "forbidden"
    ],
    unsupportedHints: [
      "not available in your country",
      "unsupported region",
      "not available in your region"
    ]
  },
  {
    key: "perplexity",
    name: "Perplexity",
    type: "reach",
    url: "https://www.perplexity.ai/",
    okHints: ["perplexity"],
    warnHints: [
      "verify you are human",
      "access denied",
      "temporarily unavailable",
      "forbidden"
    ],
    unsupportedHints: []
  },
  {
    key: "copilot",
    name: "Copilot",
    type: "reach",
    url: "https://copilot.microsoft.com/",
    okHints: ["copilot", "microsoft"],
    warnHints: [
      "verify you are human",
      "access denied",
      "forbidden",
      "sign in"
    ],
    unsupportedHints: [
      "not available in your region",
      "not available in your country"
    ]
  }
];

// ========= 参数 =========
const args = parseArgs();
const POLICY = args.policy || DEFAULT_POLICY;
const TIMEOUT = Math.max(3, parseInt(args.timeout || "8", 10)) * 1000;

let panel = {
  title: decodeURIComponentSafe(args.title || "AI Suite")
};

(async () => {
  const trace = await getTrace();
  const loc = (trace.loc || "XX").toUpperCase();
  const flag = getCountryFlagEmoji(loc);

  const results = [];
  for (const service of SERVICES) {
    const item = await checkService(service, loc);
    results.push(item);
  }

  const score = results.reduce((s, x) => s + x.score, 0);
  const maxScore = SERVICES.length * 2;

  const okCount = results.filter(x => x.level === "ok").length;
  const warnCount = results.filter(x => x.level === "warn").length;
  const badCount = results.filter(x => x.level === "bad").length;

  applyOverallIcon(score, maxScore, warnCount, badCount);

  const lines = [
    `出口 ${flag} ${loc} | 策略 ${POLICY} | ${score}/${maxScore}`,
    ...results.map(x => `${pad(x.name, 10)} ${x.emoji} ${x.text}`)
  ];

  panel.content = lines.join("\n");
})().catch(err => {
  console.log("AI Suite error:", String(err));
  applyErrorIcon();
  panel.content = `检测失败 | 策略 ${POLICY}`;
}).finally(() => {
  $done(panel);
});

// ========= 核心逻辑 =========

async function getTrace() {
  const res = await httpGet(TRACE_URL);
  const data = res.data || "";
  const lines = data.split("\n");
  const obj = {};
  lines.forEach(line => {
    const i = line.indexOf("=");
    if (i > 0) obj[line.slice(0, i)] = line.slice(i + 1);
  });
  return obj;
}

async function checkService(service, loc) {
  try {
    if (service.type === "gpt") {
      return await checkGPT(service, loc);
    }
    return await checkPage(service);
  } catch (e) {
    return makeResult(service.name, "⏱", "超时/异常", "bad", 0);
  }
}

async function checkGPT(service, loc) {
  const supported = GPT_SUPPORTED.includes(loc);

  if (!supported) {
    return makeResult(service.name, "❌", `地区不支持 (${loc})`, "bad", 0);
  }

  const res = await httpGet(service.url);
  const analyzed = analyzePage(res, service);

  if (analyzed.level === "bad") {
    return makeResult(service.name, "⚠️", `地区支持，但网页受限`, "warn", 1);
  }
  if (analyzed.level === "warn") {
    return makeResult(service.name, "⚠️", `地区支持，需验证/受限`, "warn", 1);
  }
  return makeResult(service.name, "✅", `地区支持 (${loc})`, "ok", 2);
}

async function checkPage(service) {
  const res = await httpGet(service.url);
  return analyzePage(res, service);
}

function analyzePage(res, service) {
  const status = res.response && res.response.status ? res.response.status : 0;
  const headers = lowerHeaders(res.response && res.response.headers ? res.response.headers : {});
  const location = String(headers.location || "").toLowerCase();
  const body = String(res.data || "").toLowerCase();

  if (containsAny(body, service.unsupportedHints) || containsAny(location, service.unsupportedHints)) {
    return makeResult(service.name, "❌", "地区不支持", "bad", 0);
  }

  if (status === 401 || status === 403 || status === 429) {
    return makeResult(service.name, "⚠️", `受限 (${status})`, "warn", 1);
  }

  if (containsAny(body, service.warnHints) || containsAny(location, service.warnHints)) {
    return makeResult(service.name, "⚠️", "可达但受限", "warn", 1);
  }

  if (status >= 200 && status < 400) {
    if (containsAny(body, service.okHints) || containsAny(location, service.okHints) || body.length > 200) {
      return makeResult(service.name, "✅", "可达", "ok", 2);
    }
    return makeResult(service.name, "⚠️", "可达但结果不明确", "warn", 1);
  }

  if (status >= 500) {
    return makeResult(service.name, "⚠️", `服务异常 (${status})`, "warn", 1);
  }

  return makeResult(service.name, "❌", `不可用 (${status || "ERR"})`, "bad", 0);
}

// ========= 工具 =========

function httpGet(url) {
  return Promise.race([
    new Promise((resolve, reject) => {
      $httpClient.get({
        url,
        policy: POLICY,
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9"
        }
      }, (error, response, data) => {
        if (error) return reject(error);
        resolve({ response, data });
      });
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT))
  ]);
}

function parseArgs() {
  const out = {};
  if (typeof $argument === "undefined" || !$argument) return out;
  $argument.split("&").forEach(pair => {
    const idx = pair.indexOf("=");
    if (idx === -1) return;
    const k = pair.slice(0, idx);
    const v = pair.slice(idx + 1);
    out[k] = v;
  });
  return out;
}

function decodeURIComponentSafe(v) {
  try { return decodeURIComponent(v); } catch { return v; }
}

function containsAny(text, arr) {
  if (!text || !arr || !arr.length) return false;
  return arr.some(x => text.includes(String(x).toLowerCase()));
}

function lowerHeaders(headers) {
  const out = {};
  Object.keys(headers || {}).forEach(k => {
    out[String(k).toLowerCase()] = headers[k];
  });
  return out;
}

function makeResult(name, emoji, text, level, score) {
  return { name, emoji, text, level, score };
}

function pad(str, len) {
  str = String(str);
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function getCountryFlagEmoji(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  if (countryCode.toUpperCase() === "TW") countryCode = "CN";
  const codePoints = countryCode
    .toUpperCase()
    .split("")
    .map(char => 127397 + char.charCodeAt());
  return String.fromCodePoint(...codePoints);
}

function applyOverallIcon(score, maxScore, warnCount, badCount) {
  const goodIcon = args.icon || "brain";
  const goodColor = args["icon-color"] || "#4F46E5";
  const warnIcon = args.iconwarn || "exclamationmark.triangle";
  const warnColor = args["iconwarn-color"] || "#F59E0B";
  const errIcon = args.iconerr || "xmark.octagon.fill";
  const errColor = args["iconerr-color"] || "#EF4444";

  if (score >= maxScore - 1 && badCount === 0) {
    panel.icon = goodIcon;
    panel["icon-color"] = goodColor;
    return;
  }
  if (badCount === 0 && warnCount > 0) {
    panel.icon = warnIcon;
    panel["icon-color"] = warnColor;
    return;
  }
  panel.icon = errIcon;
  panel["icon-color"] = errColor;
}

function applyErrorIcon() {
  panel.icon = args.iconerr || "xmark.octagon.fill";
  panel["icon-color"] = args["iconerr-color"] || "#EF4444";
}
