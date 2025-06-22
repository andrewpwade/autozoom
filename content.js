"use strict";

const DEV_MODE = false;

const config = {
  minFontSize: 15,
  zoomLevel: 1.35,
  maxElementsToAnalyze: 200,
  batchSize: 50,
  analysisDelay: 1000,
};

function log(level, message, data = null) {
  if (!DEV_MODE && level === "info") return;
  const logMethod = console[level] || console.log;
  if (data) {
    logMethod(`[AutoZoom] ${message}`, data);
  } else {
    logMethod(`[AutoZoom] ${message}`);
  }
}

async function initializeExtension() {
  try {
    const settings = await chrome.storage.sync.get({
      minFontSize: 15,
      zoomLevel: 1.35,
    });
    config.minFontSize = settings.minFontSize;
    config.zoomLevel = settings.zoomLevel;
    log("info", `Settings: ${config.minFontSize}px, ${config.zoomLevel}x`);
  } catch (error) {
    log("error", "Failed to load settings", error);
  }
}

function handleMessage(message, sender, sendResponse) {
  switch (message.action) {
    case "settingsUpdated":
      handleSettingsUpdate(message.settings);
      sendResponse({ success: true });
      break;
    case "reanalyze":
      clearDomainCache();
      scheduleAnalysis(500);
      sendResponse({ success: true });
      break;
    default:
      sendResponse({ success: false, error: "Unknown action" });
  }
}

function handleSettingsUpdate(settings) {
  if (!settings) return;
  config.minFontSize = settings.minFontSize || config.minFontSize;
  config.zoomLevel = settings.zoomLevel || config.zoomLevel;
  log("info", "Settings updated");
  clearDomainCache();
  scheduleAnalysis(500);
}

function clearDomainCache() {
  const domain = window.location.hostname;
  sessionStorage.removeItem(`AutoZoom_${domain}`);
}

function getStorageKey(domain) {
  return `AutoZoom_${domain}`;
}

function scheduleAnalysis(delay = 0) {
  setTimeout(() => {
    analyzeAndZoom().catch((error) => log("error", "Analysis failed", error));
  }, delay);
}

async function bootstrap() {
  await initializeExtension();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", handleDOMReady);
  } else {
    handleDOMReady();
  }
  if (document.readyState !== "complete") {
    window.addEventListener("load", handleWindowLoad);
  }
}

function handleDOMReady() {
  log("info", "DOM ready");
  scheduleAnalysis(config.analysisDelay);
}

function handleWindowLoad() {
  log("info", "Window loaded");
  scheduleAnalysis(0);
}

// Set up message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Start the extension
bootstrap();

async function analyzeAndZoom() {
  const domain = window.location.hostname;
  const storageKey = getStorageKey(domain);

  if (!DEV_MODE && sessionStorage.getItem(storageKey)) {
    log("info", "Already processed");
    return;
  }

  log("info", "Analyzing text size");
  const container = findMainContentContainer();
  const textElements = getTextElements(container);

  if (textElements.length === 0) {
    log("warn", "No text elements found");
    return;
  }

  const elementsToAnalyze = textElements.slice(0, config.maxElementsToAnalyze);
  const fontSizes = await analyzeTextSizes(elementsToAnalyze);
  const predominantSize = calculatePredominantSize(fontSizes);

  await checkAndApplyZoom(predominantSize, domain, storageKey);
}

function findMainContentContainer() {
  const selectors = [
    "main",
    "#main",
    ".main",
    "#content",
    ".content",
    "article",
    ".post",
    "#post",
  ];

  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (isVisibleElement(element)) {
      return element;
    }
  }
  return document.body;
}

function getTextElements(container) {
  const elements = Array.from(
    container.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li, td, th"),
  );
  return elements.filter((element) => {
    const text = element.textContent?.trim();
    return text && text.length >= 10 && isVisibleElement(element);
  });
}

function isVisibleElement(element) {
  return element && element.offsetWidth > 0 && element.offsetHeight > 0;
}

function analyzeTextSizes(elements) {
  return new Promise((resolve) => {
    const fontSizes = {};
    let processedCount = 0;

    function processBatch() {
      const endIndex = Math.min(
        processedCount + config.batchSize,
        elements.length,
      );

      for (let i = processedCount; i < endIndex; i++) {
        const element = elements[i];
        try {
          const fontSize = parseFloat(
            window.getComputedStyle(element).fontSize,
          );
          const textLength = element.textContent.trim().length;
          if (fontSize > 0 && textLength > 0) {
            fontSizes[fontSize] = (fontSizes[fontSize] || 0) + textLength;
          }
        } catch (error) {
          // Skip failed elements
        }
      }

      processedCount = endIndex;
      if (processedCount < elements.length) {
        setTimeout(processBatch, 0);
      } else {
        resolve(fontSizes);
      }
    }

    processBatch();
  });
}

function calculatePredominantSize(fontSizes) {
  let predominantSize = 0;
  let maxWeight = 0;

  for (const [size, weight] of Object.entries(fontSizes)) {
    if (weight > maxWeight) {
      maxWeight = weight;
      predominantSize = parseFloat(size);
    }
  }
  return predominantSize;
}

async function checkAndApplyZoom(predominantSize, domain, storageKey) {
  log("info", `Text size: ${predominantSize}px (min: ${config.minFontSize}px)`);

  if (predominantSize <= 0) {
    sessionStorage.setItem(storageKey, "processed");
    return;
  }

  if (predominantSize >= config.minFontSize) {
    log("info", "Text size OK");
    sessionStorage.setItem(storageKey, "processed");
    return;
  }

  const currentZoom = await getCurrentZoom();
  if (currentZoom !== 1.0 && currentZoom >= config.zoomLevel) {
    log("info", "User zoom sufficient");
    sessionStorage.setItem(storageKey, "processed");
    return;
  }

  log("info", `Applying ${Math.round(config.zoomLevel * 100)}% zoom`);
  const success = await applyZoom(config.zoomLevel);

  if (success) {
    sessionStorage.setItem(storageKey, "zoomed");
    addResetButton();
  }
}

function getCurrentZoom() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "getZoom" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        reject(new Error("Failed to get zoom"));
      } else {
        resolve(response.zoomLevel || 1.0);
      }
    });
  });
}

function applyZoom(zoomLevel) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "setZoom", zoomLevel }, (response) => {
      resolve(response?.success || false);
    });
  });
}

function addResetButton() {
  const buttonId = "autozoom-reset-button";
  if (document.getElementById(buttonId)) return;

  const button = createResetButton(buttonId);
  document.body.appendChild(button);
}

function createResetButton(buttonId) {
  const button = document.createElement("button");
  button.id = buttonId;
  button.textContent = "Reset Zoom";
  button.type = "button";

  Object.assign(button.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647",
    padding: "8px 12px",
    backgroundColor: "#4285f4",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  });

  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "#3367d6";
  });

  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "#4285f4";
  });

  button.addEventListener("click", handleResetClick);
  return button;
}

async function handleResetClick(event) {
  const button = event.target;
  button.disabled = true;
  button.textContent = "Resetting...";

  const success = await applyZoom(1.0);
  if (success) {
    clearDomainCache();
    button.remove();
    log("info", "Zoom reset");
  } else {
    button.disabled = false;
    button.textContent = "Reset Zoom";
  }
}
