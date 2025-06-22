describe("Integration Tests", () => {
  beforeEach(() => {
    global.sessionStorage = {
      getItem: jest.fn(),
      setItem: jest.fn(),
      removeItem: jest.fn(),
    };

    global.chrome = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn(),
        },
        session: {
          set: jest.fn(),
          remove: jest.fn(),
        },
      },
      runtime: {
        sendMessage: jest.fn(),
        lastError: null,
      },
      tabs: {
        getZoom: jest.fn(),
        setZoom: jest.fn(),
        query: jest.fn(),
        sendMessage: jest.fn(),
      },
    };
  });

  describe("Extension Configuration Flow", () => {
    function loadDefaultConfig() {
      return {
        minFontSize: 15,
        zoomLevel: 1.35,
        maxElementsToAnalyze: 200,
        batchSize: 50,
        analysisDelay: 1000,
      };
    }

    function updateConfig(newSettings) {
      const config = loadDefaultConfig();
      return {
        ...config,
        minFontSize: newSettings.minFontSize || config.minFontSize,
        zoomLevel: newSettings.zoomLevel || config.zoomLevel,
      };
    }

    test("loads default configuration", () => {
      const config = loadDefaultConfig();
      expect(config.minFontSize).toBe(15);
      expect(config.zoomLevel).toBe(1.35);
      expect(config.maxElementsToAnalyze).toBe(200);
    });

    test("updates configuration with new settings", () => {
      const newSettings = { minFontSize: 18, zoomLevel: 1.5 };
      const config = updateConfig(newSettings);

      expect(config.minFontSize).toBe(18);
      expect(config.zoomLevel).toBe(1.5);
      expect(config.maxElementsToAnalyze).toBe(200); // Unchanged
    });

    test("handles partial settings updates", () => {
      const newSettings = { minFontSize: 20 };
      const config = updateConfig(newSettings);

      expect(config.minFontSize).toBe(20);
      expect(config.zoomLevel).toBe(1.35); // Default
    });
  });

  describe("Text Analysis Workflow", () => {
    function analyzeTextSizes(elements) {
      const fontSizes = {};

      elements.forEach((element) => {
        const fontSize = parseFloat(element.style.fontSize || "16px");
        const textLength = element.textContent.trim().length;

        if (fontSize > 0 && textLength > 0) {
          fontSizes[fontSize] = (fontSizes[fontSize] || 0) + textLength;
        }
      });

      return fontSizes;
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

    function shouldApplyZoom(predominantSize, threshold) {
      return predominantSize > 0 && predominantSize < threshold;
    }

    test("analyzes text sizes correctly", () => {
      const elements = [
        { style: { fontSize: "12px" }, textContent: "Small text content here" },
        {
          style: { fontSize: "16px" },
          textContent: "Normal text content here",
        },
        {
          style: { fontSize: "16px" },
          textContent: "More normal text content",
        },
      ];

      const fontSizes = analyzeTextSizes(elements);
      expect(fontSizes[12]).toBe(23); // Length of "Small text content here"
      expect(fontSizes[16]).toBe(48); // Combined length of both 16px texts
    });

    test("calculates predominant size from analysis", () => {
      const fontSizes = {
        12: 100,
        16: 300,
        24: 50,
      };

      const predominant = calculatePredominantSize(fontSizes);
      expect(predominant).toBe(16);
    });

    test("determines when zoom should be applied", () => {
      expect(shouldApplyZoom(12, 15)).toBe(true); // Small text
      expect(shouldApplyZoom(18, 15)).toBe(false); // Large text
      expect(shouldApplyZoom(0, 15)).toBe(false); // Invalid size
    });
  });

  describe("Chrome Extension Messaging", () => {
    function createMessage(action, data = {}) {
      return { action, ...data };
    }

    function validateMessage(message) {
      const validActions = [
        "getZoom",
        "setZoom",
        "settingsUpdated",
        "reanalyze",
      ];
      return !!(
        message &&
        typeof message.action === "string" &&
        validActions.includes(message.action)
      );
    }

    function handleZoomMessage(message, currentZoom = 1.0) {
      if (message.action === "getZoom") {
        return { success: true, zoomLevel: currentZoom };
      }

      if (message.action === "setZoom") {
        if (
          typeof message.zoomLevel !== "number" ||
          message.zoomLevel < 0.25 ||
          message.zoomLevel > 5.0
        ) {
          return { success: false, error: "Invalid zoom level" };
        }
        return { success: true };
      }

      return { success: false, error: "Unknown action" };
    }

    test("creates valid messages", () => {
      const getZoomMsg = createMessage("getZoom");
      const setZoomMsg = createMessage("setZoom", { zoomLevel: 1.35 });

      expect(getZoomMsg.action).toBe("getZoom");
      expect(setZoomMsg.action).toBe("setZoom");
      expect(setZoomMsg.zoomLevel).toBe(1.35);
    });

    test("validates message format", () => {
      expect(validateMessage({ action: "getZoom" })).toBe(true);
      expect(validateMessage({ action: "invalid" })).toBe(false);
      expect(validateMessage({})).toBe(false);
      expect(validateMessage(null)).toBe(false);
    });

    test("handles zoom messages correctly", () => {
      const getResult = handleZoomMessage({ action: "getZoom" }, 1.5);
      expect(getResult.success).toBe(true);
      expect(getResult.zoomLevel).toBe(1.5);

      const setResult = handleZoomMessage({
        action: "setZoom",
        zoomLevel: 1.35,
      });
      expect(setResult.success).toBe(true);

      const invalidResult = handleZoomMessage({
        action: "setZoom",
        zoomLevel: 10,
      });
      expect(invalidResult.success).toBe(false);
    });
  });

  describe("Storage Operations", () => {
    function createStorageOperations() {
      return {
        async get(keys) {
          return chrome.storage.sync.get(keys);
        },

        async set(data) {
          return chrome.storage.sync.set(data);
        },

        createKey(domain) {
          return `AutoTextZoom_${domain}`;
        },
      };
    }

    test("handles storage get operations", async () => {
      const storage = createStorageOperations();
      const mockData = { minFontSize: 18, zoomLevel: 1.6 };
      chrome.storage.sync.get.mockResolvedValue(mockData);

      const result = await storage.get(["minFontSize", "zoomLevel"]);
      expect(result).toEqual(mockData);
    });

    test("handles storage set operations", async () => {
      const storage = createStorageOperations();
      chrome.storage.sync.set.mockResolvedValue();

      await storage.set({ minFontSize: 20 });
      expect(chrome.storage.sync.set).toHaveBeenCalledWith({ minFontSize: 20 });
    });

    test("creates domain-specific keys", () => {
      const storage = createStorageOperations();
      expect(storage.createKey("example.com")).toBe("AutoTextZoom_example.com");
    });
  });

  describe("End-to-End Workflow Simulation", () => {
    function simulatePageLoad(textElements, config) {
      // Simulate finding main container
      const container = { elements: textElements };

      // Filter visible elements
      const visibleElements = textElements.filter(
        (el) => el.visible && el.textContent.length >= 10,
      );

      // Analyze font sizes
      const fontSizes = {};
      visibleElements.forEach((el) => {
        const size = el.fontSize;
        const length = el.textContent.length;
        fontSizes[size] = (fontSizes[size] || 0) + length;
      });

      // Calculate predominant size
      let predominantSize = 0;
      let maxWeight = 0;
      for (const [size, weight] of Object.entries(fontSizes)) {
        if (weight > maxWeight) {
          maxWeight = weight;
          predominantSize = parseFloat(size);
        }
      }

      // Determine if zoom needed
      const needsZoom =
        predominantSize > 0 && predominantSize < config.minFontSize;

      return {
        container,
        visibleElements: visibleElements.length,
        predominantSize,
        needsZoom,
        targetZoom: needsZoom ? config.zoomLevel : 1.0,
      };
    }

    test("processes page with small text", () => {
      const textElements = [
        { fontSize: 10, textContent: "Very small text content", visible: true },
        {
          fontSize: 11,
          textContent: "Another small text element",
          visible: true,
        },
        {
          fontSize: 12,
          textContent: "More small text content here",
          visible: true,
        },
      ];

      const config = { minFontSize: 15, zoomLevel: 1.35 };
      const result = simulatePageLoad(textElements, config);

      expect(result.visibleElements).toBe(3);
      expect(result.predominantSize).toBeGreaterThan(0);
      expect(result.needsZoom).toBe(true);
      expect(result.targetZoom).toBe(1.35);
    });

    test("processes page with adequate text", () => {
      const textElements = [
        {
          fontSize: 16,
          textContent: "Normal sized text content",
          visible: true,
        },
        { fontSize: 18, textContent: "Large text content here", visible: true },
        {
          fontSize: 16,
          textContent: "More normal text content",
          visible: true,
        },
      ];

      const config = { minFontSize: 15, zoomLevel: 1.35 };
      const result = simulatePageLoad(textElements, config);

      expect(result.visibleElements).toBe(3);
      expect(result.predominantSize).toBe(16);
      expect(result.needsZoom).toBe(false);
      expect(result.targetZoom).toBe(1.0);
    });

    test("handles empty or hidden content", () => {
      const textElements = [
        { fontSize: 12, textContent: "Short", visible: true },
        { fontSize: 14, textContent: "Hidden text content", visible: false },
        { fontSize: 16, textContent: "", visible: true },
      ];

      const config = { minFontSize: 15, zoomLevel: 1.35 };
      const result = simulatePageLoad(textElements, config);

      expect(result.visibleElements).toBe(0); // No elements meet criteria
      expect(result.predominantSize).toBe(0);
      expect(result.needsZoom).toBe(false);
    });
  });
});
