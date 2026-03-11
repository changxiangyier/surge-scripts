/**
 * AI Suite Panel - Pro
 * 适用于 Surge Information Panel
 *
 * argument 支持：
 * title=AI Suite
 * policy=AI Suite
 * mode=detailed            // compact / detailed
 * showScore=true           // true / false
 * timeout=8                // 秒
 *
 * 示例：
 * argument=title=AI%20Suite&policy=AI%20Suite&mode=detailed&showScore=true&timeout=8
 */

const DEFAULT_OPTIONS = {
  title: "AI Suite",
  policy: "AI Suite",
  mode: "detailed",
  showScore: "true",
  timeout: "8",
};

const SERVICES = [
  {
    key: "chatgpt",
    name: "ChatGPT",
    url: "https://chat.openai.com/",
    availableHints: ["openai", "chatgpt"],
    limitedHints: [
      "access denied",
      "unsupported country",
      "not available in your country",
      "you do not have access",
      "checking your browser",
      "cf-chl",
    ],
    blockedStatus: [403, 451],
  },
  {
    key: "gemini",
    name: "Gemini",
    url: "https://gemini.google.com/",
    availableHints: ["gemini", "google ai"],
    limitedHints: [
      "isn't currently supported in your country",
      "not available in your region",
      "unsupported country",
      "unable to access",
      "sign in",
    ],
    blockedStatus: [403, 451],
  },
  {
    key: "claude",
    name: "Claude",
    url: "https://claude.ai/",
    availableHints: ["claude", "anthropic"],
    limitedHints: [
      "not available in your country",
      "unsupported region",
      "access denied",
      "verify you are human",
      "checking if the site connection is secure",
    ],
    blockedStatus: [403, 451],
  },
  {
    key: "perplexity",
    name: "Perplexity",
    url: "https://www.perplexity.ai/",
    availableHints: ["perplexity"],
    limitedHints: [
      "access denied",
      "temporarily unavailable",
      "verify you are human",
      "checking your browser",
    ],
    blockedStatus: [403, 451],
  },
  {
    key: "copilot",
    name: "Copilot",
    url: "https://copilot.microsoft.com/",
    availableHints: ["copilot", "microsoft"],
    limitedHints: [
      "not available in your region",
      "not available in your country",
      "access denied",
      "forbidden",
      "verify you are human",
    ],
    blockedStatus: [403, 451],
  },
];

const options = getOptions();
const REQUEST_TIMEOUT_MS = parseInt(options.timeout || "8", 10) * 1000;

let panel = {
  title: options.title || "AI Suite",
};

(async () => {
  const results = await Promise.all(
    SERVICES.map((service) => checkService(service, options.policy))
  );

  renderPanel(results);
})()
  .catch((err) => {
    console.log("AI Suite Panel fatal error:", String(err));
    panel.style = "error";
    panel.content = "检测失败";
  })
  .finally(() => {
    $done(panel);
  });

function checkService(service, policy) {
  return Promise.race([
    httpGet(service.url, policy),
    timeoutPromise(REQUEST_TIMEOUT_MS, "TIMEOUT"),
  ])
    .then((resp) => analyzeResponse(service, resp))
    .catch((err) => {
      const msg = String(err || "");
      if (msg === "TIMEOUT") {
        return buildResult(service, "timeout", "⏱", "超时", 0);
      }
      return buildResult(service, "error", "❓", "异常", 0);
    });
}

function analyzeResponse(service, resp) {
  if (!resp || !resp.response) {
    return buildResult(service, "error", "❓", "异常", 0);
  }

  const status = resp.response.status || 0;
  const headers = normalizeHeaders(resp.response.headers || {});
  const body = (resp.data || "").toLowerCase();
  const location = String(headers.location || "").toLowerCase();
  const finalUrl =
    String(headers["x-originating-url"] || "") ||
    String(headers["x-final-url"] || "") ||
    "";

  if (service.blockedStatus.includes(status)) {
    return buildResult(service, "blocked", "❌", "不可用", 0, {
      status,
      finalUrl,
    });
  }

  if (status === 401) {
    return buildResult(service, "limited", "⚠️", "受限", 1, {
      status,
      finalUrl,
    });
  }

  if (status >= 500) {
    return buildResult(service, "error", "❓", "异常", 0, {
      status,
      finalUrl,
    });
  }

  if (containsAny(body, service.limitedHints) || containsAny(location, service.limitedHints)) {
    return buildResult(service, "limited", "⚠️", "受限", 1, {
      status,
      finalUrl,
    });
  }

  if (status >= 200 && status < 400) {
    if (containsAny(body, service.availableHints)) {
      return buildResult(service, "available", "✅", "可用", 2, {
        status,
        finalUrl,
      });
    }

    // 对某些站点正文特征不稳定时，2xx/3xx 默认给受限或可用的保守判断
    if (status === 200) {
      return buildResult(service, "available", "✅", "可用", 2, {
        status,
        finalUrl,
      });
    }

    if (status >= 300 && status < 400) {
      return buildResult(service, "limited", "⚠️", "受限", 1, {
        status,
        finalUrl,
      });
    }
  }

  return buildResult(service, "error", "❓", "异常", 0, {
    status,
    finalUrl,
  });
}

function renderPanel(results) {
  const score = results.reduce((sum, item) => sum + item.score, 0);
  const maxScore = SERVICES.length * 2;

  const availableCount = results.filter((x) => x.status === "available").length;
  const limitedCount = results.filter((x) => x.status === "limited").length;
  const blockedCount = results.filter((x) => x.status === "blocked").length;
  const timeoutCount = results.filter((x) => x.status === "timeout").length;
  const errorCount = results.filter((x) => x.status === "error").length;

  applyOverallStyle(score, maxScore, blockedCount, timeoutCount, errorCount);

  const headerParts = [];
  if (String(options.showScore).toLowerCase() === "true") {
    headerParts.push(`评分 ${score}/${maxScore}`);
  }
  headerParts.push(`策略 ${options.policy}`);

  const headerLine = headerParts.join(" | ");

  let lines = [];
  if ((options.mode || "detailed").toLowerCase() === "compact") {
    lines = [
      headerLine,
      results.map((r) => `${r.name}${r.emoji}`).join(" "),
    ];
  } else {
    lines = [
      headerLine,
      `可用${availableCount} 受限${limitedCount} 不可用${blockedCount} 超时${timeoutCount + errorCount}`,
      ...results.map((r) => formatServiceLine(r)),
    ];
  }

  panel.content = lines.join("\n");
}

function formatServiceLine(result) {
  const short = padRight(result.name, 10);
  return `${short} ${result.emoji} ${result.label}`;
}

function applyOverallStyle(score, maxScore, blockedCount, timeoutCount, errorCount) {
  const ratio = maxScore > 0 ? score / maxScore : 0;

  if (ratio >= 0.8) {
    panel.icon = "sparkles";
    panel["icon-color"] = "#16A34A";
    return;
  }

  if (blockedCount > 0 || timeoutCount > 0 || errorCount > 0) {
    panel.icon = "exclamationmark.triangle";
    panel["icon-color"] = "#F59E0B";
    return;
  }

  panel.icon = "wifi.exclamationmark";
  panel["icon-color"] = "#EF4444";
}

function buildResult(service, status, emoji, label, score, extra) {
  return {
    key: service.key,
    name: service.name,
    status,
    emoji,
    label,
    score,
    extra: extra || {},
  };
}

function httpGet(url, policy) {
  return new Promise((resolve, reject) => {
    const req = {
      url,
      policy,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    };

    $httpClient.get(req, (error, response, data) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ response, data });
    });
  });
}

function timeoutPromise(ms, reason) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(reason), ms);
  });
}

function containsAny(text, patterns) {
  if (!text) return false;
  return patterns.some((p) => text.includes(String(p).toLowerCase()));
}

function normalizeHeaders(headers) {
  const obj = {};
  Object.keys(headers || {}).forEach((k) => {
    obj[String(k).toLowerCase()] = headers[k];
  });
  return obj;
}

function padRight(str, len) {
  const s = String(str);
  return s.length >= len ? s : s + " ".repeat(len - s.length);
}

function getOptions() {
  const result = Object.assign({}, DEFAULT_OPTIONS);

  if (typeof $argument !== "undefined" && $argument) {
    try {
      const pairs = $argument.split("&").map((item) => item.split("="));
      for (const [k, v] of pairs) {
        if (!k) continue;
        result[k] = decodeURIComponent(v || "");
      }
    } catch (e) {
      console.log("argument parse error:", String(e));
    }
  }

  return result;
}
