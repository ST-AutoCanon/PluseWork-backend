const axios = require("axios");
const fs = require("fs");
const path = require("path");

const url =
  process.argv[2] || "https://www.pulsework.in/images/sukalpa_logo.png";

(async () => {
  try {
    const resp = await axios.get(url, {
      responseType: "arraybuffer",
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const out = path.join(
      "/tmp",
      "logo-test" +
        (resp.headers["content-type"] &&
        resp.headers["content-type"].includes("png")
          ? ".png"
          : ".bin")
    );
    fs.writeFileSync(out, resp.data);
  } catch (err) {
    console.error("Fetch failed:", err.message);
    if (err.response) {
      console.error("Response status:", err.response.status);
      console.error("Response headers:", err.response.headers);
      try {
        console.error("Body snippet:", String(err.response.data).slice(0, 500));
      } catch (e) {}
    } else {
      console.error(err.stack);
    }
  }
})();
