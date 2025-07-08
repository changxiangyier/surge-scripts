// multi-traffic-check.js
(async () => {
  try {
    const args = Object.fromEntries(
      $argument
        .split("&")
        .map(item => item.split("="))
        .map(([k, v]) => [k, v ? decodeURIComponent(v) : null])
    );

    const url = args.url;
    if (!url) return $done({ content: "❗未提供订阅链接", title: "订阅信息获取失败" });

    const info = await getInfo(url);
    if (!info) return $done({ content: "⚠️ 无法获取流量信息", title: args.title || "机场信息" });

    const used = info.upload + info.download;
    const total = info.total;
    const resetDayLeft = args.reset_day ? getResetDayLeft(Number(args.reset_day)) : null;
    const expireDate = info.expire;
    const expireDaysLeft = getExpireLeft(expireDate);

    const toGB = (b) => (b / (1024 ** 3)).toFixed(2) + " GB";

    const content = [
      `用量：${toGB(used)} / ${toGB(total)}`,
      expireDaysLeft ? `到期：${formatDate(expireDate)}（剩余${expireDaysLeft}天）` : `到期：未知`
    ];

    if (resetDayLeft) content.push(`距离流量重置还有 ${resetDayLeft} 天`);

    const percentage = ((used / total) * 100).toFixed(1);
    content.push(`已用 ${percentage}%`);

    $done({
      title: args.title || "机场信息",
      content: content.join("\n"),
      icon: args.icon || "antenna.radiowaves.left.and.right",
      "icon-color": args.color || "#5AA9E6"
    });

  } catch (e) {
    console.log("异常: " + e);
    $done({
      title: "获取失败",
      content: String(e),
      icon: "xmark.octagon",
      "icon-color": "#FF3333"
    });
  }
})();

function getInfo(url) {
  return new Promise((resolve, reject) => {
    $httpClient.get({ url }, (err, resp) => {
      if (err) return reject(err);
      const h = Object.keys(resp.headers).find(k => k.toLowerCase() === "subscription-userinfo");
      if (!h) return reject("未获取到流量信息头");
      const info = Object.fromEntries(
        resp.headers[h].split(";").map(i => i.trim().split("=")).map(([k, v]) => [k, Number(v)])
      );
      resolve(info);
    });
  });
}

function getResetDayLeft(resetDay) {
  const now = new Date();
  const today = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  if (resetDay > today) return resetDay - today;
  return daysInMonth - today + resetDay;
}

function getExpireLeft(timestamp) {
  if (!timestamp) return null;
  const days = Math.floor((timestamp * 1000 - Date.now()) / (1000 * 60 * 60 * 24));
  return days > 0 ? days : null;
}

function formatDate(ts) {
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
