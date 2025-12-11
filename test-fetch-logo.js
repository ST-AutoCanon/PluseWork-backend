// test-fetch-logo.js
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const url =
  process.argv[2] || "https://www.pulsework.in/images/sukalpa_logo.png";

(async () => {
  try {
    console.log("Fetching:", url);
    const resp = await axios.get(url, {
      responseType: "arraybuffer",
      maxRedirects: 5,
      timeout: 10000,
      headers: {
        // try a normal browser UA and a minimal UA — helps detect UA-blocking
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    console.log("Status:", resp.status);
    console.log("Content-Type:", resp.headers["content-type"]);
    console.log(
      "Content-Length:",
      resp.headers["content-length"] || resp.data.length
    );
    console.log("Redirected from:", resp.request?.res?.responseUrl || "none");

    const out = path.join(
      "/tmp",
      "logo-test" +
        (resp.headers["content-type"] &&
        resp.headers["content-type"].includes("png")
          ? ".png"
          : ".bin")
    );
    fs.writeFileSync(out, resp.data);
    console.log("Saved to:", out);
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
