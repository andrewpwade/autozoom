/**
 * Auto Text Zoom Background Script
 * Handles zoom operations and tab management
 */

"use strict";

// Constants
const EXTENSION_NAME = "AutoTextZoom";
const ZOOM_BOUNDS = { min: 0.25, max: 5.0 };
const ZOOM_INCREMENT = 0.05;
const ZOOM_DELAY = 10;

/**
 * Message handler for content script requests
 * @param {Object} message - Message from content script
 * @param {Object} sender - Message sender info
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} True if response will be sent asynchronously
 */
function handleMessage(message, sender, sendResponse) {
  try {
    // Validate sender
    if (!sender?.tab?.id) {
      sendResponse({ success: false, error: "Invalid sender" });
      return false;
    }

    const tabId = sender.tab.id;

    switch (message.action) {
      case "setZoom":
        handleSetZoom(tabId, message.zoomLevel, sendResponse);
        return true; // Async response

      case "getZoom":
        handleGetZoom(tabId, sendResponse);
        return true; // Async response

      default:
        console.warn(`[${EXTENSION_NAME}] Unknown action: ${message.action}`);
        sendResponse({ success: false, error: "Unknown action" });
        return false;
    }
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] Message handler error:`, error);
    sendResponse({ success: false, error: error.message });
    return false;
  }
}

/**
 * Handle zoom setting request
 * @param {number} tabId - Tab ID
 * @param {number} zoomLevel - Target zoom level
 * @param {Function} sendResponse - Response callback
 */
function handleSetZoom(tabId, zoomLevel, sendResponse) {
  // Validate zoom level
  if (
    typeof zoomLevel !== "number" ||
    zoomLevel < ZOOM_BOUNDS.min ||
    zoomLevel > ZOOM_BOUNDS.max
  ) {
    sendResponse({
      success: false,
      error: `Invalid zoom level. Must be between ${ZOOM_BOUNDS.min} and ${ZOOM_BOUNDS.max}`,
    });
    return;
  }

  applyGradualZoom(tabId, zoomLevel, sendResponse);
}

/**
 * Handle zoom getting request
 * @param {number} tabId - Tab ID
 * @param {Function} sendResponse - Response callback
 */
function handleGetZoom(tabId, sendResponse) {
  chrome.tabs.getZoom(tabId, (zoomFactor) => {
    if (chrome.runtime.lastError) {
      console.error(
        `[${EXTENSION_NAME}] Error getting zoom:`,
        chrome.runtime.lastError,
      );
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true, zoomLevel: zoomFactor || 1.0 });
    }
  });
}

// Set up message listener
chrome.runtime.onMessage.addListener(handleMessage);

/**
 * Apply zoom gradually to make transitions smoother
 * @param {number} tabId - Tab ID
 * @param {number} targetZoom - Target zoom level
 * @param {Function} sendResponse - Response callback
 */
function applyGradualZoom(tabId, targetZoom, sendResponse) {
  chrome.tabs.getZoom(tabId, (currentZoom) => {
    if (chrome.runtime.lastError) {
      console.error(
        `[${EXTENSION_NAME}] Error getting current zoom:`,
        chrome.runtime.lastError,
      );
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    // If already at target (within tolerance), we're done
    if (Math.abs(currentZoom - targetZoom) < 0.01) {
      storeZoomLevel(tabId, targetZoom);
      sendResponse({ success: true });
      return;
    }

    // Calculate next zoom step
    const isZoomingIn = targetZoom > currentZoom;
    const increment = isZoomingIn ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
    const nextZoom = clampZoom(currentZoom + increment);

    // Apply zoom step
    chrome.tabs.setZoom(tabId, nextZoom, () => {
      if (chrome.runtime.lastError) {
        console.error(
          `[${EXTENSION_NAME}] Error setting zoom:`,
          chrome.runtime.lastError,
        );
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      // Check if we've reached the target
      if (
        (isZoomingIn && nextZoom >= targetZoom) ||
        (!isZoomingIn && nextZoom <= targetZoom)
      ) {
        // Set exact target zoom
        setFinalZoom(tabId, targetZoom, sendResponse);
      } else {
        // Continue with next increment
        setTimeout(() => {
          applyGradualZoom(tabId, targetZoom, sendResponse);
        }, ZOOM_DELAY);
      }
    });
  });
}

/**
 * Set final zoom level precisely
 * @param {number} tabId - Tab ID
 * @param {number} targetZoom - Target zoom level
 * @param {Function} sendResponse - Response callback
 */
function setFinalZoom(tabId, targetZoom, sendResponse) {
  chrome.tabs.setZoom(tabId, targetZoom, () => {
    if (chrome.runtime.lastError) {
      console.error(
        `[${EXTENSION_NAME}] Error setting final zoom:`,
        chrome.runtime.lastError,
      );
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      storeZoomLevel(tabId, targetZoom);
      sendResponse({ success: true });
    }
  });
}

/**
 * Clamp zoom level to valid bounds
 * @param {number} zoom - Zoom level to clamp
 * @returns {number} Clamped zoom level
 */
function clampZoom(zoom) {
  return Math.min(Math.max(zoom, ZOOM_BOUNDS.min), ZOOM_BOUNDS.max);
}

/**
 * Store zoom level in session storage
 * @param {number} tabId - Tab ID
 * @param {number} zoomLevel - Zoom level to store
 */
function storeZoomLevel(tabId, zoomLevel) {
  try {
    chrome.storage.session.set({
      [`zoom_${tabId}`]: zoomLevel,
      [`zoom_timestamp_${tabId}`]: Date.now(),
    });
  } catch (error) {
    console.warn(`[${EXTENSION_NAME}] Failed to store zoom level:`, error);
  }
}

/**
 * Clean up old zoom data on tab removal
 * @param {number} tabId - Removed tab ID
 */
function handleTabRemoved(tabId) {
  try {
    chrome.storage.session.remove([`zoom_${tabId}`, `zoom_timestamp_${tabId}`]);
  } catch (error) {
    console.warn(`[${EXTENSION_NAME}] Failed to clean up tab data:`, error);
  }
}

/**
 * Handle extension installation/update
 */
chrome.runtime.onInstalled.addListener((details) => {
  console.log(`[${EXTENSION_NAME}] Extension ${details.reason}`);

  if (details.reason === "install") {
    // Set default settings on first install
    chrome.storage.sync
      .set({
        minFontSize: 15,
        zoomLevel: 1.35,
      })
      .catch((error) => {
        console.error(
          `[${EXTENSION_NAME}] Failed to set default settings:`,
          error,
        );
      });
  }
});

// Set up tab removal listener for cleanup
chrome.tabs.onRemoved.addListener(handleTabRemoved);
