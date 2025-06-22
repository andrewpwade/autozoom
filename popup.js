/**
 * Auto Text Zoom Popup Script
 * Handles settings UI and storage
 */

"use strict";

// Constants
const EXTENSION_NAME = "AutoTextZoom";
const DEFAULT_SETTINGS = {
  minFontSize: 15,
  zoomLevel: 1.35,
};

const VALIDATION_RULES = {
  minFontSize: { min: 2, max: 24 },
  zoomLevel: { min: 1.0, max: 2.0 },
};

const DEBOUNCE_DELAY = 1000;

// DOM elements
let elements = {};
let saveTimeout = null;

/**
 * Initialize popup when DOM is ready
 */
function initializePopup() {
  try {
    cacheElements();
    loadSettings();
    setupEventListeners();

    log("info", "Popup initialized successfully");
  } catch (error) {
    log("error", "Failed to initialize popup", error);
    showMessage("Failed to initialize settings", "error");
  }
}

/**
 * Cache DOM element references
 */
function cacheElements() {
  const elementIds = [
    "minFontSize",
    "fontSizeValue",
    "zoomLevel",
    "zoomValue",
    "saveBtn",
    "resetBtn",
    "status",
  ];

  elementIds.forEach((id) => {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Required element '${id}' not found`);
    }
    elements[id] = element;
  });
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
  // Button event listeners
  elements.saveBtn.addEventListener("click", () => saveSettings(true));
  elements.resetBtn.addEventListener("click", resetSettings);

  // Input event listeners with debounced auto-save
  elements.minFontSize.addEventListener("input", () => {
    updateFontSizeDisplay();
    debouncedSave();
  });

  elements.zoomLevel.addEventListener("input", () => {
    updateZoomDisplay();
    debouncedSave();
  });

  // Keyboard navigation support
  document.addEventListener("keydown", handleKeyDown);
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 */
function handleKeyDown(event) {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
      case "s":
        event.preventDefault();
        saveSettings(true);
        break;
      case "r":
        event.preventDefault();
        resetSettings();
        break;
    }
  }
}

/**
 * Debounced save function
 */
function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveSettings(false); // Silent save
  }, DEBOUNCE_DELAY);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePopup);
} else {
  initializePopup();
}

/**
 * Load settings from storage
 * @returns {Promise<void>}
 */
async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

    // Apply settings directly (they should be valid from storage)
    elements.minFontSize.value =
      settings.minFontSize || DEFAULT_SETTINGS.minFontSize;
    elements.zoomLevel.value = settings.zoomLevel || DEFAULT_SETTINGS.zoomLevel;

    updateFontSizeDisplay();
    updateZoomDisplay();

    log("info", "Settings loaded successfully", settings);
  } catch (error) {
    log("error", "Failed to load settings", error);
    showMessage("Failed to load settings", "error");

    // Fall back to defaults
    resetToDefaults();
  }
}

/**
 * Update font size display
 */
function updateFontSizeDisplay() {
  try {
    const fontSize = parseInt(elements.minFontSize.value, 10);
    if (isNaN(fontSize)) {
      throw new Error("Invalid font size value");
    }

    elements.fontSizeValue.textContent = `${fontSize}px`;
  } catch (error) {
    log("error", "Failed to update font size display", error);
  }
}

/**
 * Update zoom percentage display
 */
function updateZoomDisplay() {
  try {
    const zoomLevel = parseFloat(elements.zoomLevel.value);
    if (isNaN(zoomLevel)) {
      throw new Error("Invalid zoom level value");
    }

    const percentage = Math.round(zoomLevel * 100);
    elements.zoomValue.textContent = `${percentage}%`;
  } catch (error) {
    log("error", "Failed to update zoom display", error);
  }
}

/**
 * Save settings to storage
 * @param {boolean} showStatus - Whether to show status message
 * @returns {Promise<void>}
 */
async function saveSettings(showStatus = true) {
  try {
    // Disable save button to prevent double-clicks
    elements.saveBtn.disabled = true;

    const settings = {
      minFontSize: parseInt(elements.minFontSize.value, 10),
      zoomLevel: parseFloat(elements.zoomLevel.value),
    };

    // Validate settings
    const validationResult = validateSettings(settings);
    if (!validationResult.isValid) {
      throw new Error(validationResult.error);
    }

    // Save to storage
    await chrome.storage.sync.set(validationResult.settings);

    if (showStatus) {
      showMessage("Settings saved!", "success");
    }

    // Notify content scripts
    await notifyContentScripts(validationResult.settings);

    log("info", "Settings saved successfully", validationResult.settings);
  } catch (error) {
    log("error", "Failed to save settings", error);
    showMessage(error.message || "Error saving settings", "error");
  } finally {
    elements.saveBtn.disabled = false;
  }
}

/**
 * Validate settings object
 * @param {Object} settings - Settings to validate
 * @returns {Object} Validation result
 */
function validateSettings(settings) {
  const result = {
    isValid: true,
    settings: { ...settings },
    error: null,
  };

  // Validate font size
  const fontSize = parseInt(settings.minFontSize, 10);
  if (
    isNaN(fontSize) ||
    fontSize < VALIDATION_RULES.minFontSize.min ||
    fontSize > VALIDATION_RULES.minFontSize.max
  ) {
    result.isValid = false;
    result.error = `Font size must be between ${VALIDATION_RULES.minFontSize.min} and ${VALIDATION_RULES.minFontSize.max} pixels`;
    return result;
  }

  // Validate zoom level
  const zoomLevel = parseFloat(settings.zoomLevel);
  if (
    isNaN(zoomLevel) ||
    zoomLevel < VALIDATION_RULES.zoomLevel.min ||
    zoomLevel > VALIDATION_RULES.zoomLevel.max
  ) {
    result.isValid = false;
    result.error = `Zoom level must be between ${VALIDATION_RULES.zoomLevel.min} and ${VALIDATION_RULES.zoomLevel.max}`;
    return result;
  }

  // Store validated values
  result.settings.minFontSize = fontSize;
  result.settings.zoomLevel = zoomLevel;

  return result;
}

/**
 * Notify content scripts of settings change
 * @param {Object} settings - New settings
 * @returns {Promise<void>}
 */
async function notifyContentScripts(settings) {
  try {
    const tabs = await chrome.tabs.query({});

    const notifications = tabs.map(async (tab) => {
      try {
        await chrome.tabs.sendMessage(tab.id, {
          action: "settingsUpdated",
          settings: settings,
        });
      } catch (error) {
        // Ignore errors for tabs without content script
        log("warn", `Failed to notify tab ${tab.id}`, error);
      }
    });

    await Promise.allSettled(notifications);
    log("info", `Notified ${tabs.length} tabs of settings change`);
  } catch (error) {
    log("error", "Failed to notify content scripts", error);
  }
}

/**
 * Reset settings to defaults
 * @returns {Promise<void>}
 */
async function resetSettings() {
  try {
    elements.resetBtn.disabled = true;

    await resetToDefaults();
    await saveSettings(true);

    log("info", "Settings reset to defaults");
  } catch (error) {
    log("error", "Failed to reset settings", error);
    showMessage("Failed to reset settings", "error");
  } finally {
    elements.resetBtn.disabled = false;
  }
}

/**
 * Reset inputs to default values
 */
function resetToDefaults() {
  elements.minFontSize.value = DEFAULT_SETTINGS.minFontSize;
  elements.zoomLevel.value = DEFAULT_SETTINGS.zoomLevel;
  updateFontSizeDisplay();
  updateZoomDisplay();
}

/**
 * Show status message to user
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, info)
 */
function showMessage(message, type = "success") {
  try {
    elements.status.textContent = message;

    // Reset classes
    elements.status.className = "status";

    // Add type-specific class
    if (type === "error") {
      elements.status.classList.add("error");
    } else if (type === "success") {
      elements.status.classList.add("success");
    }

    // Clear message after delay
    setTimeout(() => {
      elements.status.textContent = "";
      elements.status.className = "status";
    }, 3000);
  } catch (error) {
    log("error", "Failed to show message", { message, type, error });
  }
}

/**
 * Logging utility
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {*} data - Optional data
 */
function log(level, message, data = null) {
  const logMethod = console[level] || console.log;
  const prefix = `[${EXTENSION_NAME} Popup]`;

  if (data) {
    logMethod(`${prefix} ${message}`, data);
  } else {
    logMethod(`${prefix} ${message}`);
  }
}
