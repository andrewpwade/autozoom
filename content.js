/**
 * Auto Text Zoom Content Script
 * Analyzes page text size and applies zoom when text is too small
 */

"use strict";

// Constants
const EXTENSION_NAME = "AutoTextZoom";
const INSTANCE_ID = `${EXTENSION_NAME}-${Math.random().toString(36).substring(2, 10)}`;
const DEV_MODE = false; // Set to true for development logging

// Default configuration (will be overridden by user settings)
const DEFAULT_CONFIG = {
  minFontSize: 15,
  zoomLevel: 1.35,
  maxElementsToAnalyze: 200,
  batchSize: 50,
  analysisDelay: 1000,
};

// Runtime configuration
let config = { ...DEFAULT_CONFIG };

/**
 * Safe logging utility that respects DEV_MODE
 * @param {string} level - Log level (info, warn, error)
 * @param {string} message - Message to log
 * @param {*} data - Optional data to log
 */
function log(level, message, data = null) {
  if (!DEV_MODE && level === "info") return;

  const logMethod = console[level] || console.log;
  const prefix = `[${EXTENSION_NAME} ${INSTANCE_ID}]`;

  if (data) {
    logMethod(`${prefix} ${message}`, data);
  } else {
    logMethod(`${prefix} ${message}`);
  }
}

/**
 * Initialize extension with user settings
 * @returns {Promise<void>}
 */
async function initializeExtension() {
  try {
    const settings = await chrome.storage.sync.get({
      minFontSize: DEFAULT_CONFIG.minFontSize,
      zoomLevel: DEFAULT_CONFIG.zoomLevel,
    });

    config.minFontSize = settings.minFontSize;
    config.zoomLevel = settings.zoomLevel;

    log(
      "info",
      `Settings loaded: min font size = ${config.minFontSize}px, zoom level = ${config.zoomLevel}`,
    );
  } catch (error) {
    log("error", "Failed to load settings, using defaults", error);
  }
}

/**
 * Message handler for settings updates and other commands
 * @param {Object} message - Message from popup or background
 * @param {Object} sender - Message sender info
 * @param {Function} sendResponse - Response callback
 */
function handleMessage(message, sender, sendResponse) {
  try {
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
        log("warn", `Unknown message action: ${message.action}`);
        sendResponse({ success: false, error: "Unknown action" });
    }
  } catch (error) {
    log("error", "Error handling message", { message, error });
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle settings update from popup
 * @param {Object} settings - New settings
 */
function handleSettingsUpdate(settings) {
  if (!settings || typeof settings !== "object") {
    throw new Error("Invalid settings object");
  }

  config.minFontSize = settings.minFontSize || config.minFontSize;
  config.zoomLevel = settings.zoomLevel || config.zoomLevel;

  log(
    "info",
    `Settings updated: min font size = ${config.minFontSize}px, zoom level = ${config.zoomLevel}`,
  );

  clearDomainCache();
  scheduleAnalysis(500);
}

/**
 * Clear domain cache to force re-analysis
 */
function clearDomainCache() {
  const domain = window.location.hostname;
  const storageKey = getStorageKey(domain);
  sessionStorage.removeItem(storageKey);
}

/**
 * Get storage key for domain
 * @param {string} domain - Domain name
 * @returns {string} Storage key
 */
function getStorageKey(domain) {
  return `${EXTENSION_NAME}_${domain}`;
}

/**
 * Schedule analysis with delay
 * @param {number} delay - Delay in milliseconds
 */
function scheduleAnalysis(delay = 0) {
  setTimeout(() => {
    analyzeAndZoom().catch((error) => {
      log("error", "Analysis failed", error);
    });
  }, delay);
}

/**
 * Initialize extension and set up event listeners
 */
async function bootstrap() {
  try {
    await initializeExtension();

    // Set up event listeners
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", handleDOMReady);
    } else {
      handleDOMReady();
    }

    // Fallback for window load
    if (document.readyState !== "complete") {
      window.addEventListener("load", handleWindowLoad);
    }
  } catch (error) {
    log("error", "Bootstrap failed", error);
  }
}

/**
 * Handle DOM ready event
 */
function handleDOMReady() {
  log("info", "DOM content loaded");
  scheduleAnalysis(config.analysisDelay);
}

/**
 * Handle window load event
 */
function handleWindowLoad() {
  log("info", "Window load complete");
  scheduleAnalysis(0);
}

// Set up message listener
chrome.runtime.onMessage.addListener(handleMessage);

// Start the extension
bootstrap();

/**
 * Main analysis function
 * @returns {Promise<void>}
 */
async function analyzeAndZoom() {
  const domain = window.location.hostname;
  const storageKey = getStorageKey(domain);

  // Skip analysis if already processed (unless in dev mode)
  if (!DEV_MODE && sessionStorage.getItem(storageKey)) {
    log("info", `Domain ${domain} already processed - skipping analysis`);
    return;
  }

  try {
    log("info", "Starting text size analysis");

    const container = findMainContentContainer();
    const textElements = getTextElements(container);

    if (textElements.length === 0) {
      log("warn", "No text elements found for analysis");
      return;
    }

    const elementsToAnalyze = textElements.slice(
      0,
      config.maxElementsToAnalyze,
    );

    log(
      "info",
      `Analyzing ${elementsToAnalyze.length} text elements (from ${textElements.length} total)`,
    );

    const fontSizes = await analyzeTextSizes(elementsToAnalyze);
    const predominantSize = calculatePredominantSize(fontSizes);

    await checkAndApplyZoom(predominantSize, domain, storageKey);
  } catch (error) {
    log("error", "Analysis failed", error);
  }
}

/**
 * Find the main content container
 * @returns {Element} Main content container or document.body
 */
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
      log("info", `Found main content container: ${selector}`);
      return element;
    }
  }

  return document.body;
}

/**
 * Get visible text elements for analysis
 * @param {Element} container - Container to search within
 * @returns {Element[]} Array of text elements
 */
function getTextElements(container) {
  const selector = "p, h1, h2, h3, h4, h5, h6, li, td, th";
  const elements = Array.from(container.querySelectorAll(selector));

  return elements.filter((element) => {
    const text = element.textContent?.trim();
    return text && text.length >= 10 && isVisibleElement(element);
  });
}

/**
 * Check if element is visible
 * @param {Element} element - Element to check
 * @returns {boolean} True if visible
 */
function isVisibleElement(element) {
  return element && element.offsetWidth > 0 && element.offsetHeight > 0;
}

/**
 * Analyze text sizes in batches
 * @param {Element[]} elements - Elements to analyze
 * @returns {Promise<Object>} Map of font sizes to weights
 */
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
          log("warn", "Failed to analyze element", error);
        }
      }

      processedCount = endIndex;

      if (processedCount < elements.length) {
        // Schedule next batch
        setTimeout(processBatch, 0);
      } else {
        resolve(fontSizes);
      }
    }

    processBatch();
  });
}

/**
 * Calculate predominant font size
 * @param {Object} fontSizes - Map of font sizes to weights
 * @returns {number} Predominant font size
 */
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

/**
 * Check if zoom is needed and apply it
 * @param {number} predominantSize - Predominant font size
 * @param {string} domain - Current domain
 * @param {string} storageKey - Storage key for domain
 * @returns {Promise<void>}
 */
async function checkAndApplyZoom(predominantSize, domain, storageKey) {
  log(
    "info",
    `Predominant text size: ${predominantSize}px (threshold: ${config.minFontSize}px)`,
  );
  log("info", `Current config:`, config);

  if (predominantSize <= 0) {
    log("warn", `Invalid predominant size: ${predominantSize}px`);
    sessionStorage.setItem(storageKey, "processed");
    return;
  }

  if (predominantSize >= config.minFontSize) {
    log("info", `Text size is adequate (${predominantSize}px), no zoom needed`);
    sessionStorage.setItem(storageKey, "processed");
    return;
  }

  try {
    const currentZoom = await getCurrentZoom();

    // Respect user's existing zoom preference
    if (currentZoom !== 1.0 && currentZoom >= config.zoomLevel) {
      log(
        "info",
        `User has sufficient zoom (${Math.round(currentZoom * 100)}%), respecting preference`,
      );
      sessionStorage.setItem(storageKey, "processed");
      return;
    }

    log(
      "info",
      `Text too small, applying ${Math.round(config.zoomLevel * 100)}% zoom`,
    );

    const success = await applyZoom(config.zoomLevel);

    if (success) {
      log("info", "Zoom applied successfully");
      sessionStorage.setItem(storageKey, "zoomed");
      addResetButton();
    } else {
      log("error", "Failed to apply zoom");
    }
  } catch (error) {
    log("error", "Error during zoom check/apply", error);
  }
}

/**
 * Get current zoom level
 * @returns {Promise<number>} Current zoom level
 */
function getCurrentZoom() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "getZoom" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (!response) {
        reject(new Error("No response from background script"));
      } else if (!response.success) {
        reject(new Error(response.error || "Failed to get zoom level"));
      } else {
        resolve(response.zoomLevel || 1.0);
      }
    });
  });
}

/**
 * Apply zoom level
 * @param {number} zoomLevel - Zoom level to apply
 * @returns {Promise<boolean>} Success status
 */
function applyZoom(zoomLevel) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "setZoom", zoomLevel }, (response) => {
      if (chrome.runtime.lastError) {
        log("error", "Runtime error applying zoom", chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(response?.success || false);
      }
    });
  });
}

/**
 * Add reset button to page
 */
function addResetButton() {
  const buttonId = `${EXTENSION_NAME}-reset-button`;

  // Check if button already exists
  if (document.getElementById(buttonId)) {
    return;
  }

  try {
    const button = createResetButton(buttonId);
    document.body.appendChild(button);
    log("info", "Reset button added");
  } catch (error) {
    log("error", "Failed to add reset button", error);
  }
}

/**
 * Create reset button element
 * @param {string} buttonId - Button ID
 * @returns {HTMLButtonElement} Button element
 */
function createResetButton(buttonId) {
  const button = document.createElement("button");

  // Set attributes
  button.id = buttonId;
  button.textContent = "Reset Zoom";
  button.type = "button";
  button.setAttribute("aria-label", "Reset page zoom to 100%");

  // Apply styles
  Object.assign(button.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    zIndex: "2147483647", // Maximum z-index
    padding: "8px 12px",
    backgroundColor: "#4285f4",
    color: "white",
    border: "none",
    borderRadius: "4px",
    cursor: "pointer",
    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
    fontSize: "14px",
    fontFamily: "system-ui, -apple-system, sans-serif",
    transition: "all 0.2s ease",
  });

  // Add hover effect
  button.addEventListener("mouseenter", () => {
    button.style.backgroundColor = "#3367d6";
    button.style.transform = "translateY(-1px)";
  });

  button.addEventListener("mouseleave", () => {
    button.style.backgroundColor = "#4285f4";
    button.style.transform = "translateY(0)";
  });

  // Add click handler
  button.addEventListener("click", handleResetClick);

  return button;
}

/**
 * Handle reset button click
 * @param {Event} event - Click event
 */
async function handleResetClick(event) {
  const button = event.target;

  try {
    button.disabled = true;
    button.textContent = "Resetting...";

    // Reset zoom
    const success = await applyZoom(1.0);

    if (success) {
      // Clear domain cache
      clearDomainCache();

      // Remove button
      button.remove();

      log("info", "Zoom reset to 100%");
    } else {
      throw new Error("Failed to reset zoom");
    }
  } catch (error) {
    log("error", "Reset failed", error);

    // Restore button state
    button.disabled = false;
    button.textContent = "Reset Zoom";
  }
}
