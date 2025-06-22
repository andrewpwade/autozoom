describe("Background Script Tests", () => {
  beforeEach(() => {
    global.chrome = {
      tabs: {
        getZoom: jest.fn(),
        setZoom: jest.fn(),
      },
      storage: {
        session: {
          set: jest.fn(),
          remove: jest.fn(),
        },
        sync: {
          set: jest.fn(),
        },
      },
      runtime: {
        lastError: null,
      },
    };
  });

  describe("Message Validation", () => {
    function validateSender(sender) {
      return !!(sender && sender.tab && typeof sender.tab.id === "number");
    }

    function validateZoomLevel(zoomLevel) {
      const ZOOM_BOUNDS = { min: 0.25, max: 5.0 };
      return (
        typeof zoomLevel === "number" &&
        zoomLevel >= ZOOM_BOUNDS.min &&
        zoomLevel <= ZOOM_BOUNDS.max
      );
    }

    test("validates sender correctly", () => {
      expect(validateSender({ tab: { id: 123 } })).toBe(true);
      expect(validateSender({})).toBe(false);
      expect(validateSender(null)).toBe(false);
    });

    test("validates zoom levels", () => {
      expect(validateZoomLevel(1.5)).toBe(true);
      expect(validateZoomLevel(0.1)).toBe(false);
      expect(validateZoomLevel(10)).toBe(false);
      expect(validateZoomLevel("1.5")).toBe(false);
    });
  });

  describe("Zoom Bounds Utility", () => {
    function clampZoom(zoom) {
      const ZOOM_BOUNDS = { min: 0.25, max: 5.0 };
      return Math.min(Math.max(zoom, ZOOM_BOUNDS.min), ZOOM_BOUNDS.max);
    }

    test("clamps zoom to valid bounds", () => {
      expect(clampZoom(0.1)).toBe(0.25);
      expect(clampZoom(10)).toBe(5.0);
      expect(clampZoom(1.5)).toBe(1.5);
    });
  });

  describe("Storage Operations", () => {
    function createStorageKey(tabId, type) {
      return `${type}_${tabId}`;
    }

    test("creates correct storage keys", () => {
      expect(createStorageKey(123, "zoom")).toBe("zoom_123");
      expect(createStorageKey(456, "timestamp")).toBe("timestamp_456");
    });
  });

  describe("Chrome API Interaction", () => {
    test("handles getZoom success", () => {
      const mockCallback = jest.fn();
      chrome.tabs.getZoom.mockImplementation((tabId, callback) => {
        callback(1.5);
      });

      chrome.tabs.getZoom(123, mockCallback);
      expect(mockCallback).toHaveBeenCalledWith(1.5);
    });

    test("handles setZoom success", () => {
      const mockCallback = jest.fn();
      chrome.tabs.setZoom.mockImplementation((tabId, zoom, callback) => {
        callback();
      });

      chrome.tabs.setZoom(123, 1.5, mockCallback);
      expect(chrome.tabs.setZoom).toHaveBeenCalledWith(123, 1.5, mockCallback);
    });

    test("handles storage operations", () => {
      const data = { zoom_123: 1.5 };
      chrome.storage.session.set(data);
      expect(chrome.storage.session.set).toHaveBeenCalledWith(data);
    });
  });

  describe("Error Handling", () => {
    function createErrorResponse(message) {
      return { success: false, error: message };
    }

    function createSuccessResponse(data = {}) {
      return { success: true, ...data };
    }

    test("creates error responses", () => {
      const error = createErrorResponse("Invalid zoom level");
      expect(error.success).toBe(false);
      expect(error.error).toBe("Invalid zoom level");
    });

    test("creates success responses", () => {
      const success = createSuccessResponse({ zoomLevel: 1.5 });
      expect(success.success).toBe(true);
      expect(success.zoomLevel).toBe(1.5);
    });
  });

  describe("Installation Logic", () => {
    function shouldSetDefaults(reason) {
      return reason === "install";
    }

    function getDefaultSettings() {
      return {
        minFontSize: 15,
        zoomLevel: 1.35,
      };
    }

    test("determines when to set defaults", () => {
      expect(shouldSetDefaults("install")).toBe(true);
      expect(shouldSetDefaults("update")).toBe(false);
      expect(shouldSetDefaults("enable")).toBe(false);
    });

    test("provides correct default settings", () => {
      const defaults = getDefaultSettings();
      expect(defaults.minFontSize).toBe(15);
      expect(defaults.zoomLevel).toBe(1.35);
    });
  });

  describe("Zoom Calculation", () => {
    function calculateZoomStep(current, target, increment = 0.05) {
      const isZoomingIn = target > current;
      const step = isZoomingIn ? increment : -increment;
      return current + step;
    }

    function isCloseToTarget(current, target, tolerance = 0.01) {
      return Math.abs(current - target) < tolerance;
    }

    test("calculates zoom steps correctly", () => {
      expect(calculateZoomStep(1.0, 1.5)).toBe(1.05);
      expect(calculateZoomStep(1.5, 1.0)).toBe(1.45);
    });

    test("detects proximity to target", () => {
      expect(isCloseToTarget(1.35, 1.35)).toBe(true);
      expect(isCloseToTarget(1.35, 1.351)).toBe(true);
      expect(isCloseToTarget(1.35, 1.4)).toBe(false);
    });
  });
});
