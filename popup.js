"use strict";

const DEFAULT_SETTINGS = {
  minFontSize: 15,
  zoomLevel: 1.35,
};

const VALIDATION_RULES = {
  minFontSize: { min: 2, max: 24 },
  zoomLevel: { min: 1.0, max: 2.0 },
};

const DEBOUNCE_DELAY = 1000;

const elements = {};
let saveTimeout = null;

function initializePopup() {
  cacheElements();
  loadSettings();
  setupEventListeners();
}

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
    elements[id] = document.getElementById(id);
  });
}

function setupEventListeners() {
  elements.saveBtn.addEventListener("click", () => saveSettings(true));
  elements.resetBtn.addEventListener("click", resetSettings);

  elements.minFontSize.addEventListener("input", () => {
    updateFontSizeDisplay();
    debouncedSave();
  });

  elements.zoomLevel.addEventListener("input", () => {
    updateZoomDisplay();
    debouncedSave();
  });

  document.addEventListener("keydown", handleKeyDown);
}

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

function debouncedSave() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => saveSettings(false), DEBOUNCE_DELAY);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePopup);
} else {
  initializePopup();
}

async function loadSettings() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    elements.minFontSize.value =
      settings.minFontSize || DEFAULT_SETTINGS.minFontSize;
    elements.zoomLevel.value = settings.zoomLevel || DEFAULT_SETTINGS.zoomLevel;
    updateFontSizeDisplay();
    updateZoomDisplay();
  } catch (error) {
    resetToDefaults();
  }
}

function updateFontSizeDisplay() {
  const fontSize = parseInt(elements.minFontSize.value, 10);
  if (!isNaN(fontSize)) {
    elements.fontSizeValue.textContent = `${fontSize}px`;
  }
}

function updateZoomDisplay() {
  const zoomLevel = parseFloat(elements.zoomLevel.value);
  if (!isNaN(zoomLevel)) {
    const percentage = Math.round(zoomLevel * 100);
    elements.zoomValue.textContent = `${percentage}%`;
  }
}

async function saveSettings(showStatus = true) {
  elements.saveBtn.disabled = true;

  try {
    const settings = {
      minFontSize: parseInt(elements.minFontSize.value, 10),
      zoomLevel: parseFloat(elements.zoomLevel.value),
    };

    const validationResult = validateSettings(settings);
    if (!validationResult.isValid) {
      throw new Error(validationResult.error);
    }

    await chrome.storage.sync.set(validationResult.settings);
    if (showStatus) showMessage("Settings saved!", "success");
    await notifyContentScripts(validationResult.settings);
  } catch (error) {
    showMessage(error.message || "Error saving settings", "error");
  } finally {
    elements.saveBtn.disabled = false;
  }
}

function validateSettings(settings) {
  const result = { isValid: true, settings: { ...settings }, error: null };

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

  result.settings.minFontSize = fontSize;
  result.settings.zoomLevel = zoomLevel;
  return result;
}

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
        // Ignore tabs without content script
      }
    });
    await Promise.allSettled(notifications);
  } catch (error) {
    // Ignore notification errors
  }
}

async function resetSettings() {
  elements.resetBtn.disabled = true;
  try {
    resetToDefaults();
    await saveSettings(true);
  } catch (error) {
    showMessage("Failed to reset settings", "error");
  } finally {
    elements.resetBtn.disabled = false;
  }
}

function resetToDefaults() {
  elements.minFontSize.value = DEFAULT_SETTINGS.minFontSize;
  elements.zoomLevel.value = DEFAULT_SETTINGS.zoomLevel;
  updateFontSizeDisplay();
  updateZoomDisplay();
}

function showMessage(message, type = "success") {
  elements.status.textContent = message;
  elements.status.className = "status";

  if (type === "error") {
    elements.status.classList.add("error");
  } else if (type === "success") {
    elements.status.classList.add("success");
  }

  setTimeout(() => {
    elements.status.textContent = "";
    elements.status.className = "status";
  }, 3000);
}
