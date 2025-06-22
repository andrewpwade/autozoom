"use strict";

const ZOOM_BOUNDS = { min: 0.25, max: 5.0 };
const ZOOM_INCREMENT = 0.05;
const ZOOM_DELAY = 10;

function handleMessage(message, sender, sendResponse) {
  if (!sender?.tab?.id) {
    sendResponse({ success: false, error: "Invalid sender" });
    return false;
  }

  const tabId = sender.tab.id;
  switch (message.action) {
    case "setZoom":
      handleSetZoom(tabId, message.zoomLevel, sendResponse);
      return true;
    case "getZoom":
      handleGetZoom(tabId, sendResponse);
      return true;
    default:
      sendResponse({ success: false, error: "Unknown action" });
      return false;
  }
}

function handleSetZoom(tabId, zoomLevel, sendResponse) {
  if (
    typeof zoomLevel !== "number" ||
    zoomLevel < ZOOM_BOUNDS.min ||
    zoomLevel > ZOOM_BOUNDS.max
  ) {
    sendResponse({ success: false, error: "Invalid zoom level" });
    return;
  }
  applyGradualZoom(tabId, zoomLevel, sendResponse);
}

function handleGetZoom(tabId, sendResponse) {
  chrome.tabs.getZoom(tabId, (zoomFactor) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      sendResponse({ success: true, zoomLevel: zoomFactor || 1.0 });
    }
  });
}

// Set up message listener
chrome.runtime.onMessage.addListener(handleMessage);

function applyGradualZoom(tabId, targetZoom, sendResponse) {
  chrome.tabs.getZoom(tabId, (currentZoom) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    if (Math.abs(currentZoom - targetZoom) < 0.01) {
      storeZoomLevel(tabId, targetZoom);
      sendResponse({ success: true });
      return;
    }

    const isZoomingIn = targetZoom > currentZoom;
    const increment = isZoomingIn ? ZOOM_INCREMENT : -ZOOM_INCREMENT;
    const nextZoom = clampZoom(currentZoom + increment);

    chrome.tabs.setZoom(tabId, nextZoom, () => {
      if (chrome.runtime.lastError) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError.message,
        });
        return;
      }

      if (
        (isZoomingIn && nextZoom >= targetZoom) ||
        (!isZoomingIn && nextZoom <= targetZoom)
      ) {
        setFinalZoom(tabId, targetZoom, sendResponse);
      } else {
        setTimeout(
          () => applyGradualZoom(tabId, targetZoom, sendResponse),
          ZOOM_DELAY,
        );
      }
    });
  });
}

function setFinalZoom(tabId, targetZoom, sendResponse) {
  chrome.tabs.setZoom(tabId, targetZoom, () => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
    } else {
      storeZoomLevel(tabId, targetZoom);
      sendResponse({ success: true });
    }
  });
}

function clampZoom(zoom) {
  return Math.min(Math.max(zoom, ZOOM_BOUNDS.min), ZOOM_BOUNDS.max);
}

function storeZoomLevel(tabId, zoomLevel) {
  chrome.storage.session
    .set({
      [`zoom_${tabId}`]: zoomLevel,
      [`zoom_timestamp_${tabId}`]: Date.now(),
    })
    .catch(() => {});
}

function handleTabRemoved(tabId) {
  chrome.storage.session
    .remove([`zoom_${tabId}`, `zoom_timestamp_${tabId}`])
    .catch(() => {});
}

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    chrome.storage.sync
      .set({
        minFontSize: 15,
        zoomLevel: 1.35,
      })
      .catch(() => {});
  }
});

chrome.tabs.onRemoved.addListener(handleTabRemoved);
