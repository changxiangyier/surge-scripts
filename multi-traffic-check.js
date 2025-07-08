// multi-traffic-check.js
let urls = $argument.urls?.split("||") ?? [];

if (urls.length === 0) {
  $done({ info: "❗未传入任何订阅链接参数（urls）" });
}

let results = [];
let doneCount = 0;

urls.forEach((url, index) => {
  $httpClient.get(url, function (error, response, data) {
    let name = `机场${index + 1}`;
    if (error) {
      results[index] = `${name}: ❌ 请求失败`;
    } else {
      const header = response.headers['subscription-userinfo'] || response.headers['Subscription-Userinfo'];
      if (!header) {
        results[index] = `${name}: ⚠️ 无流量信息`;
      } else {
        const info = {};
        header.split(";").forEach(item => {
          const [k, v] = item.trim().split("=");
          info[k] = Number(v);
        });

        const format = (bytes) => {
          const GB = 1024 ** 3;
          return (bytes / GB).toFixed(2) + " GB";
        };

        const used = format(info.upload + info.download);
        const total = format(info.total);
        const expire = info.expire ? new Date(info.expire * 1000).toLocaleDateString() : "未知";

        results[index] = `${name}: ${used} / ${total}（到期: ${expire}）`;
      }
    }

    doneCount++;
    if (doneCount === urls.length) {
      $done({ info: results.join('\n') });
    }
  });
});
