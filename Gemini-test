/**
 *
 * [Panel]
 * gemini_check = script-name=gemini_check,title="Gemini 检测",content="请刷新",update-interval=300
 *
 * [Script]
 * gemini_check = type=generic,script-path=https://你的地址/gemini_check.js,argument=title=Gemini%20%E6%A3%80%E6%B5%8B&mode=web
 *
 * 支持 argument 参数：
 * title: 面板标题
 * mode: web / api / all
 * apiKey: Gemini API Key（可选）
 *
 * webAvailableContent: Web 可用时显示内容
 * webLimitedContent: Web 可达但受限时显示内容
 * apiOnlyContent: 仅 API 可用时显示内容
 * regionUnsupportedContent: 地区不支持时显示内容
 * errorContent: 检测失败时显示内容
 *
 * webAvailableIcon / Color / Style
 * webLimitedIcon / Color / Style
 * apiOnlyIcon / Color / Style
 * regionUnsupportedIcon / Color / Style
 * errorIcon / Color / Style
 */

const GEMINI_WEB_URL = "https://gemini.google.com/"
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models?key="

const DEFAULT_OPTIONS = {
  title: "Gemini",
  mode: "web",

  webAvailableContent: "Web 可用",
  webAvailableIcon: "sparkles",
  webAvailableIconColor: "#16A951",
  webAvailableStyle: "good",

  webLimitedContent: "入口可达，但功能受限",
  webLimitedIcon: "exclamationmark.circle",
  webLimitedIconColor: "#F59E0B",
  webLimitedStyle: "info",

  apiOnlyContent: "仅 API 可用",
  apiOnlyIcon: "chevron.left.forwardslash.chevron.right",
  apiOnlyIconColor: "#0EA5E9",
  apiOnlyStyle: "info",

  regionUnsupportedContent: "当前地区不支持",
  regionUnsupportedIcon: "xmark.octagon",
  regionUnsupportedIconColor: "#EF4444",
  regionUnsupportedStyle: "alert",

  errorContent: "检测失败，请重试",
  errorIcon: "wifi.exclamationmark",
  errorIconColor: "#EF4444",
  errorStyle: "error",
}

let options = getOptions()
let panel = {
  title: options.title,
}

;(async () => {
  const mode = (options.mode || "web").toLowerCase()

  let webResult = null
  let apiResult = null

  if (mode === "web" || mode === "all") {
    try {
      webResult = await Promise.race([testGeminiWeb(), timeout(10000)])
    } catch (e) {
      webResult = { status: "error", detail: String(e) }
    }
  }

  if ((mode === "api" || mode === "all") && options.apiKey) {
    try {
      apiResult = await Promise.race([
        testGeminiApi(options.apiKey),
        timeout(10000),
      ])
    } catch (e) {
      apiResult = { status: "error", detail: String(e) }
    }
  }

  renderPanel(webResult, apiResult, mode)
})()
  .catch((error) => {
    applyStatus("error")
    panel.content = options.errorContent
    console.log("Gemini check fatal error:", error)
  })
  .finally(() => {
    $done(panel)
  })

function renderPanel(webResult, apiResult, mode) {
  // mode = web
  if (mode === "web") {
    if (!webResult || webResult.status === "error") {
      applyStatus("error")
      panel.content = options.errorContent
      return
    }

    if (webResult.status === "available") {
      applyStatus("webAvailable")
      panel.content = options.webAvailableContent
      return
    }

    if (webResult.status === "limited") {
      applyStatus("webLimited")
      panel.content = options.webLimitedContent + formatDetail(webResult.detail)
      return
    }

    if (webResult.status === "unsupported") {
      applyStatus("regionUnsupported")
      panel.content = options.regionUnsupportedContent
      return
    }

    applyStatus("error")
    panel.content = options.errorContent
    return
  }

  // mode = api
  if (mode === "api") {
    if (!apiResult || apiResult.status === "error") {
      applyStatus("error")
      panel.content = options.errorContent
      return
    }

    if (apiResult.status === "available") {
      applyStatus("apiOnly")
      panel.content = "Gemini API 可用"
      return
    }

    if (apiResult.status === "unauthorized") {
      applyStatus("webLimited")
      panel.content = "API Key 无效或未授权"
      return
    }

    if (apiResult.status === "unsupported") {
      applyStatus("regionUnsupported")
      panel.content = options.regionUnsupportedContent
      return
    }

    applyStatus("error")
    panel.content = options.errorContent
    return
  }

  // mode = all
  if (mode === "all") {
    if (webResult && webResult.status === "available") {
      if (apiResult && apiResult.status === "available") {
        applyStatus("webAvailable")
        panel.content = "Web + API 可用"
        return
      }
      applyStatus("webAvailable")
      panel.content = "Web 可用"
      return
    }

    if (
      webResult &&
      (webResult.status === "unsupported" || webResult.status === "limited")
    ) {
      if (apiResult && apiResult.status === "available") {
        applyStatus("apiOnly")
        panel.content = options.apiOnlyContent
        return
      }

      if (webResult.status === "unsupported") {
        applyStatus("regionUnsupported")
        panel.content = options.regionUnsupportedContent
        return
      }

      applyStatus("webLimited")
      panel.content = options.webLimitedContent + formatDetail(webResult.detail)
      return
    }

    if (apiResult && apiResult.status === "available") {
      applyStatus("apiOnly")
      panel.content = options.apiOnlyContent
      return
    }

    applyStatus("error")
    panel.content = options.errorContent
  }
}

function testGeminiWeb() {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url: GEMINI_WEB_URL,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      },
      function (error, response, data) {
        if (error) {
          reject(error)
          return
        }

        const status = response?.status || 0
        const body = (data || "").toLowerCase()

        if (status >= 500 || status === 0) {
          reject("Web Error")
          return
        }

        // 地区不支持 / 区域不可用
        if (
          body.includes("isn't currently supported in your country") ||
          body.includes("not available in your region") ||
          body.includes("unsupported country")
        ) {
          resolve({ status: "unsupported" })
          return
        }

        // 正常可达：页面正常返回
        if (status === 200) {
          // 这里做几个保守判断
          if (
            body.includes("gemini") ||
            body.includes("google ai") ||
            body.includes("__NEXT_DATA__".toLowerCase())
          ) {
            resolve({ status: "available" })
            return
          }

          resolve({ status: "limited", detail: "页面可达" })
          return
        }

        if (status === 401 || status === 403) {
          resolve({ status: "limited", detail: "需登录或受限" })
          return
        }

        if (status >= 300 && status < 400) {
          resolve({ status: "limited", detail: "发生跳转" })
          return
        }

        reject("Unknown Web Status: " + status)
      }
    )
  })
}

function testGeminiApi(apiKey) {
  return new Promise((resolve, reject) => {
    $httpClient.get(
      {
        url: GEMINI_API_URL + encodeURIComponent(apiKey),
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
        },
      },
      function (error, response, data) {
        if (error) {
          reject(error)
          return
        }

        const status = response?.status || 0
        const body = (data || "").toLowerCase()

        if (status === 200) {
          resolve({ status: "available" })
          return
        }

        if (status === 400 || status === 401) {
          resolve({ status: "unauthorized" })
          return
        }

        if (
          body.includes("user location is not supported") ||
          body.includes("not available in your country") ||
          body.includes("unsupported region")
        ) {
          resolve({ status: "unsupported" })
          return
        }

        reject("Unknown API Status: " + status)
      }
    )
  })
}

function applyStatus(type) {
  const keyMap = {
    webAvailable: ["webAvailableIcon", "webAvailableIconColor", "webAvailableStyle"],
    webLimited: ["webLimitedIcon", "webLimitedIconColor", "webLimitedStyle"],
    apiOnly: ["apiOnlyIcon", "apiOnlyIconColor", "apiOnlyStyle"],
    regionUnsupported: [
      "regionUnsupportedIcon",
      "regionUnsupportedIconColor",
      "regionUnsupportedStyle",
    ],
    error: ["errorIcon", "errorIconColor", "errorStyle"],
  }

  const [iconKey, colorKey, styleKey] = keyMap[type]

  if (options[iconKey]) {
    panel.icon = options[iconKey]
    panel["icon-color"] = options[colorKey] || undefined
    delete panel.style
  } else {
    panel.style = options[styleKey]
    delete panel.icon
    delete panel["icon-color"]
  }
}

function formatDetail(detail) {
  return detail ? ` | ${detail}` : ""
}

function timeout(delay = 5000) {
  return new Promise((resolve, reject) => {
    setTimeout(() => reject("Timeout"), delay)
  })
}

function getOptions() {
  let options = Object.assign({}, DEFAULT_OPTIONS)

  if (typeof $argument !== "undefined" && $argument) {
    try {
      let params = Object.fromEntries(
        $argument
          .split("&")
          .map((item) => item.split("="))
          .map(([k, v]) => [k, decodeURIComponent(v || "")])
      )
      Object.assign(options, params)
    } catch (error) {
      console.log("$argument parse failed:", error)
    }
  }

  return options
}
