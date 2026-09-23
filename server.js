import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
const PORT = 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Load dynamic configuration from config.js
let siteConfig = {
  siteName: "يمن نت",
  defaultSpeed: "@512K/1538K|",
  fixedSpeedCardPrefixes: ["2", "3"],
  supportPhone: "770807056",
  whatsappPhone: "967770807056"
};

function refreshConfig() {
  try {
    const cfgPath = path.join(__dirname, "config.js");
    if (fs.existsSync(cfgPath)) {
      const cfgContent = fs.readFileSync(cfgPath, "utf8");
      const fn = new Function("window", cfgContent + "; return window.siteConfig || {};");
      const loaded = fn({});
      if (loaded && typeof loaded === "object" && Object.keys(loaded).length > 0) {
        siteConfig = Object.assign({}, siteConfig, loaded);
      }
    }
  } catch (e) {
    console.warn("Notice: Using fallback siteConfig:", e.message);
  }
}
refreshConfig();

// In-memory session state simulating the MikroTik router
let session = {
  logged_in: false,
  username: "",
  domain: siteConfig.defaultSpeed || "@512K/1538K|",
  loginTime: null,
  ip: "192.168.88.100",
  mac: "70:85:C2:A1:3B:9E",
  nas_id: siteConfig.siteName || "يمن نت",
  uptime: "3h 45m",
  session_time_left: "6d 12h",
  bytes_in: "194412544",
  bytes_out: "936017920",
  bytes_in_nice: "185.4 MB",
  bytes_out_nice: "892.6 MB",
  remain_bytes_total: "3435973836"
};

/**
 * MikroTik RouterOS Template Engine Simulator
 * Parses $(if ...), $(else), $(endif), and all $(variable) tags
 */
function renderMikrotikTemplate(templateContent, vars = {}) {
  let output = templateContent;

  const evalCondition = (condStr) => {
    const trimmed = condStr.trim();
    // 1. Equality check: var == "value"
    const eqMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*==\s*"(.*)"$/);
    if (eqMatch) {
      const key = eqMatch[1];
      const val = eqMatch[2];
      const actual = vars[key] !== undefined ? String(vars[key]) : "";
      return actual === val;
    }
    // 2. Inequality check: var != "value"
    const neqMatch = trimmed.match(/^([a-zA-Z0-9_-]+)\s*!=\s*"(.*)"$/);
    if (neqMatch) {
      const key = neqMatch[1];
      const val = neqMatch[2];
      const actual = vars[key] !== undefined ? String(vars[key]) : "";
      return actual !== val;
    }
    // 3. Negation: !error or !var
    if (trimmed.startsWith("!")) {
      const key = trimmed.slice(1).trim();
      const val = vars[key];
      return !val || val === "no" || val === "false" || val === "";
    }
    // 4. Boolean/truthy check: error or logged_in
    const key = trimmed;
    const val = vars[key];
    return Boolean(val && val !== "no" && val !== "false" && val !== "");
  };

  // Process nested if/else/endif structures up to 4 passes
  const ifElseRegex = /\$\(if\s+([^)]+)\)([\s\S]*?)(?:\$\(else\)([\s\S]*?))?\$\(endif\)/g;
  for (let pass = 0; pass < 4; pass++) {
    if (!output.includes("$(if")) break;
    output = output.replace(ifElseRegex, (match, condition, ifTrue, ifFalse) => {
      const isTrue = evalCondition(condition);
      return isTrue ? (ifTrue || "") : (ifFalse || "");
    });
  }

  // Replace variable substitutions: $(variable-name)
  output = output.replace(/\$\(([a-zA-Z0-9_-]+)\)/g, (match, varName) => {
    if (vars[varName] !== undefined) {
      return vars[varName];
    }
    switch (varName) {
      case "error":
      case "error_orig":
      case "error-orig":
        return vars.error || "";
      case "error-esc":
        return encodeURIComponent(vars.error || "");
      case "username":
        return vars.username || session.username || "";
      case "ip":
        return vars.ip || session.ip || "192.168.88.100";
      case "mac":
      case "mac-esc":
        return vars.mac || session.mac || "70:85:C2:A1:3B:9E";
      case "identity":
      case "nas_id":
        return vars.identity || siteConfig.siteName || "يمن نت";
      case "domain":
        return vars.domain || session.domain || siteConfig.defaultSpeed || "512K/1538K|0|pm|all|*no**|non***";
      case "logged-in":
        return vars.logged_in || (session.logged_in ? "yes" : "no");
      case "link-login-only":
        return "/login";
      case "link-logout":
        return "/logout";
      case "link-status":
        return "/status";
      case "link-orig-esc":
        return "/status";
      case "uptime":
        return vars.uptime || session.uptime || "3h 45m";
      case "uptime-secs":
        return "13500";
      case "session-time-left":
        return vars.session_time_left || session.session_time_left || "6d 12h";
      case "session-time-left-secs":
        return "561600";
      case "bytes-in":
        return vars.bytes_in || session.bytes_in || "194412544";
      case "bytes-out":
        return vars.bytes_out || session.bytes_out || "936017920";
      case "bytes-in-nice":
        return vars.bytes_in_nice || session.bytes_in_nice || "185.4 MB";
      case "bytes-out-nice":
        return vars.bytes_out_nice || session.bytes_out_nice || "892.6 MB";
      case "bytes-total-nice":
        return "1.05 GB";
      case "remain-bytes-total":
        return vars.remain_bytes_total || session.remain_bytes_total || "3435973836";
      case "remain-bytes-total-nice":
        return "3.2 GB";
      case "remain-bytes-in":
      case "remain-bytes-out":
        return "0";
      case "packets-in":
        return "142050";
      case "packets-out":
        return "210430";
      case "trial":
        return "no";
      default:
        return "";
    }
  });

  // Ensure #winmsg exists so main.min.js doesn't throw TypeError on .innerText
  if (output.includes("</body>") && !output.includes('id="winmsg"')) {
    const errText = vars.error || "";
    output = output.replace("</body>", `<span id="winmsg" style="display:none;">${errText}</span></body>`);
  }

  return output;
}

/**
 * Helper to render an HTML template file with MikroTik context
 */
function sendRenderedTemplate(res, fileName, extraVars = {}) {
  refreshConfig();
  const filePath = path.join(__dirname, fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send("File Not Found");
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const context = {
    ...session,
    siteName: siteConfig.siteName || "يمن نت",
    identity: siteConfig.siteName || "يمن نت",
    domain: session.domain || siteConfig.defaultSpeed || "512K/1538K|0|pm|all|*no**|non***",
    ...extraVars
  };

  const rendered = renderMikrotikTemplate(raw, context);
  res.setHeader("Content-Type", fileName.endsWith(".json") || extraVars.isJson ? "application/json; charset=utf-8" : "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  return res.send(rendered);
}

// -------------------------------------------------------------
// 1. PRIMARY APPLICATION & TEMPLATE ROUTES (Intercept before static)
// -------------------------------------------------------------

// Root route and index.html
app.get(["/", "/index.html"], (req, res) => {
  const errorParam = (req.query.error || "").trim();
  sendRenderedTemplate(res, "index.html", {
    error: errorParam,
    "error-esc": encodeURIComponent(errorParam)
  });
});

// Quran download & pages API
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", app: "alawla-hotspot", network: siteConfig.siteName || "يمن نت" });
});

app.get("/api/v1/public/content", (req, res) => {
  res.json({ success: true, data: { notifications: [], announcements: [] } });
});

app.get("/api/quran/info", (req, res) => {
  const surahsFile = path.join(__dirname, "js", "quran-surahs.json");
  let surahs = [];
  try {
    if (fs.existsSync(surahsFile)) {
      surahs = JSON.parse(fs.readFileSync(surahsFile, "utf8"));
    }
  } catch (err) {
    console.error("Error reading surahs file:", err);
  }
  res.json({ totalPages: 569, surahs });
});

app.get("/api/quran/page/:num", (req, res) => {
  const num = req.params.num;
  const pageFile = path.join(__dirname, "public", "quran-pages", `${num}.jpg`);
  if (fs.existsSync(pageFile)) {
    return res.sendFile(pageFile);
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><rect width="100%" height="100%" fill="#0a0f1d"/><text x="50%" y="48%" fill="#dfab52" font-family="sans-serif" font-size="24" text-anchor="middle">المصحف الشريف</text><text x="50%" y="54%" fill="#94a3b8" font-family="sans-serif" font-size="18" text-anchor="middle">صفحة ${num}</text></svg>`;
  res.setHeader("Content-Type", "image/svg+xml");
  res.send(svg);
});

app.get("/download-quran", (req, res) => {
  res.setHeader("Content-Disposition", 'attachment; filename="mobile-quran.pdf"');
  res.setHeader("Content-Type", "application/pdf");
  res.send(Buffer.from(`%PDF-1.4\n%mobile quran placeholder\n%%EOF`));
});

// Login Handler (Handles AJAX callBack, standard form POST, and GET)
app.all(["/login", "/login.html"], (req, res) => {
  refreshConfig();
  const isAjax = req.query.var !== undefined || req.xhr || req.headers.accept?.includes("application/json");
  const rawUser = (req.query.username || req.body?.username || "").trim();
  const rawPass = (req.query.password || req.body?.password || "").trim();
  let username = rawUser;
  let domain = (req.query.domain || req.body?.domain || "").trim();

  if (rawUser.includes("@")) {
    const atIndex = rawUser.indexOf("@");
    username = rawUser.substring(0, atIndex);
    domain = rawUser.substring(atIndex + 1);
  }

  // Check known mock test cases
  if (username === "2222" || username.toLowerCase() === "expired") {
    if (isAjax) {
      return res.json({ logged_in: "no", error: "no valid profile found", action: "onLoginError" });
    }
    return res.redirect("/index.html?error=" + encodeURIComponent("no valid profile found"));
  }

  if (username === "3333" || username.toLowerCase() === "used") {
    if (isAjax) {
      return res.json({ logged_in: "no", error: "simultaneous session limit reached", action: "onLoginError" });
    }
    return res.redirect("/index.html?error=" + encodeURIComponent("simultaneous session limit reached"));
  }

  if (username.toLowerCase() === "wrong" || username.toLowerCase() === "error") {
    if (isAjax) {
      return res.json({ logged_in: "no", error: "invalid username or password", action: "onLoginError" });
    }
    return res.redirect("/index.html?error=" + encodeURIComponent("invalid username or password"));
  }

  // If no username provided, respond with login template or initial state
  if (!username) {
    if (isAjax) {
      if (session.logged_in) {
        return res.json({
          logged_in: "yes",
          username: session.username,
          domain: session.domain,
          link_only: "/status",
          link_login_only: "/login",
          link_logout: "/logout",
          link_status: "/status",
          nas_id: siteConfig.siteName || "يمن نت",
          ip: session.ip,
          mac: session.mac,
          action: "onLoggedIn"
        });
      }
      return res.json({
        logged_in: "no",
        link_only: "/status",
        link_login_only: "/login",
        link_logout: "/logout",
        link_status: "/status",
        nas_id: siteConfig.siteName || "يمن نت",
        ip: session.ip,
        mac: session.mac,
        action: "onLoginStart"
      });
    }

    // Direct browser navigation without var: render login.html template
    return sendRenderedTemplate(res, "login.html", {
      var: req.query.var || "",
      error: req.query.error || ""
    });
  }

  // Determine domain / speed options
  if (!domain) {
    const isUpdateBlocked = req.headers?.cookie && (req.headers.cookie.includes("_Uoff") || req.headers.cookie.includes("*yes**"));
    const fixedPrefixes = siteConfig.fixedSpeedCardPrefixes || ["2", "3"];
    const isFixed = fixedPrefixes.some(p => username.startsWith(p));
    if (isFixed) {
      domain = isUpdateBlocked ? "fixed|0|pm|all|*yes**|non***" : "fixed|0|pm|all|*no**|non***";
    } else {
      domain = isUpdateBlocked ? "512K/1538K|0|pm|all|*yes**|non***" : "512K/1538K|0|pm|all|*no**|non***";
    }
  }

  // Authenticate session
  session = {
    ...session,
    logged_in: true,
    username,
    domain,
    loginTime: Date.now(),
    ip: req.ip || "192.168.88.100",
    mac: "70:85:C2:A1:3B:9E"
  };

  // If request came from hidden iframe form post (dst=status or popup=false), respond with alogin.html or JSON
  if (req.body?.dst || req.query.dst || isAjax) {
    return res.json({
      logged_in: "yes",
      username,
      domain,
      link_only: "/status",
      link_login_only: "/login",
      link_logout: "/logout",
      link_status: "/status",
      nas_id: siteConfig.siteName || "يمن نت",
      ip: session.ip,
      mac: session.mac,
      action: "onLoggedIn"
    });
  }

  return res.redirect("/index.html?status=connected");
});

// alogin.html route
app.all(["/alogin", "/alogin.html"], (req, res) => {
  const isAjax = req.query.var !== undefined || req.xhr || req.headers.accept?.includes("application/json");
  if (isAjax) {
    return res.json({
      logged_in: "yes",
      username: session.username || "770807777",
      mac: session.mac,
      ip: session.ip,
      link_login_only: "/login",
      sspeed: session.domain,
      spes: session.domain,
      sps: session.domain + "_",
      update: session.domain + "_",
      bytes_in: session.bytes_in,
      bytes_out: session.bytes_out,
      bytes_in_nice: session.bytes_in_nice,
      bytes_out_nice: session.bytes_out_nice,
      remain_bytes_total: session.remain_bytes_total,
      session_time_left: session.session_time_left,
      uptime: session.uptime,
      trial: "no",
      action: "onLoggedIn"
    });
  }
  return sendRenderedTemplate(res, "alogin.html", { var: req.query.var || "" });
});

// Status Handler
app.all(["/status", "/status.html"], (req, res) => {
  refreshConfig();
  const isAjax = req.query.var !== undefined || req.xhr || req.headers.accept?.includes("application/json");
  const username = session.username || req.query.username || "770807777";
  const domain = session.domain || siteConfig.defaultSpeed || "512K/1538K|0|pm|all|*no**|non***";

  if (isAjax) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    if (session.logged_in) {
      return res.json({
        logged_in: "yes",
        username,
        ip: session.ip,
        mac: session.mac,
        bytes_in: session.bytes_in,
        bytes_out: session.bytes_out,
        bytes_in_nice: session.bytes_in_nice,
        bytes_out_nice: session.bytes_out_nice,
        bytes_total_nice: "1.05 GB",
        uptime: session.uptime,
        uptime_secs: "13500",
        remain_bytes_total: session.remain_bytes_total,
        remain_bytes_total_nice: "3.2 GB",
        session_time_left: session.session_time_left,
        session_time_left_secs: "561600",
        spes: domain,
        sspeed: domain,
        sps: domain + "_",
        update: domain + "_",
        trial: "no",
        action: "onStatusQuery"
      });
    }
    return res.json({ logged_in: "no", action: "onStatusQuery" });
  }

  // If user visits /status directly in browser: render index.html (or status.html with var="")
  return sendRenderedTemplate(res, "index.html");
});

// Logout Handler
app.all(["/logout", "/logout.html"], (req, res) => {
  session.logged_in = false;
  session.username = "";
  const isAjax = req.query.var !== undefined || req.xhr || req.headers.accept?.includes("application/json");

  if (isAjax) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.json({
      logged_in: "no",
      link_login_only: "/login",
      link_logout: "/logout",
      ip: session.ip,
      bytes_in: session.bytes_in,
      bytes_in_nice: session.bytes_in_nice,
      bytes_out: session.bytes_out,
      bytes_out_nice: session.bytes_out_nice,
      remain_bytes_total: session.remain_bytes_total,
      session_time_left: session.session_time_left,
      uptime: session.uptime,
      action: "onLoggedOut"
    });
  }

  return res.redirect("/");
});

// Dashboard management panel
app.get(["/dash", "/dash.html"], (req, res) => {
  const dashPath = path.join(__dirname, "dash.html");
  if (fs.existsSync(dashPath)) {
    return res.sendFile(dashPath);
  }
  return res.status(404).send("Dashboard not found");
});

// -------------------------------------------------------------
// 2. STATIC ASSETS (Exclude raw .html files so they are always rendered)
// -------------------------------------------------------------
app.use(express.static(__dirname, {
  maxAge: "7d",
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".html") || filePath.endsWith("config.js")) {
      res.setHeader("Cache-Control", "no-cache");
    } else if (filePath.match(/\.(woff2|css|js|svg|ico|png|jpg|jpeg|webp)$/)) {
      res.setHeader("Cache-Control", "public, max-age=604800, immutable");
    }
  }
}));

// Fallback route for all other requests
app.get("{*all}", (req, res) => {
  if (path.extname(req.path)) {
    return res.status(404).send("File Not Found");
  }
  return sendRenderedTemplate(res, "index.html");
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MikroTik Hotspot Simulation Server is active at http://0.0.0.0:${PORT}`);
});
