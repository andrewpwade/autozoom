describe("Content Script Tests", () => {
  let mockElement;

  beforeEach(() => {
    mockElement = {
      offsetWidth: 100,
      offsetHeight: 50,
      textContent: "Sample text content for testing purposes",
      tagName: "P",
      style: {
        fontSize: "16px",
      },
    };

    global.window = {
      getComputedStyle: jest.fn(() => ({ fontSize: "16px" })),
      location: { hostname: "example.com" },
    };

    global.document = {
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => [mockElement]),
      body: mockElement,
    };
  });

  describe("Element Visibility Helper", () => {
    function isVisibleElement(element) {
      return !!(element && element.offsetWidth > 0 && element.offsetHeight > 0);
    }

    test("detects visible elements", () => {
      expect(isVisibleElement(mockElement)).toBe(true);
    });

    test("detects hidden elements", () => {
      const hiddenElement = { offsetWidth: 0, offsetHeight: 0 };
      expect(isVisibleElement(hiddenElement)).toBe(false);
    });

    test("handles null elements", () => {
      expect(isVisibleElement(null)).toBe(false);
      expect(isVisibleElement(undefined)).toBe(false);
    });
  });

  describe("Font Size Calculation", () => {
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

    test("calculates predominant font size correctly", () => {
      const fontSizes = {
        12: 100,
        16: 300,
        24: 50,
      };
      expect(calculatePredominantSize(fontSizes)).toBe(16);
    });

    test("handles empty font sizes", () => {
      expect(calculatePredominantSize({})).toBe(0);
    });

    test("handles single font size", () => {
      const fontSizes = { 18: 200 };
      expect(calculatePredominantSize(fontSizes)).toBe(18);
    });
  });

  describe("Storage Key Generation", () => {
    function getStorageKey(domain) {
      return `AutoTextZoom_${domain}`;
    }

    test("generates correct storage key", () => {
      expect(getStorageKey("example.com")).toBe("AutoTextZoom_example.com");
      expect(getStorageKey("localhost")).toBe("AutoTextZoom_localhost");
    });
  });

  describe("Text Element Filtering", () => {
    function getTextElements(container) {
      const elements = [
        { textContent: "Short", offsetWidth: 100, offsetHeight: 20 },
        {
          textContent: "This is a longer piece of text content",
          offsetWidth: 100,
          offsetHeight: 20,
        },
        { textContent: "", offsetWidth: 100, offsetHeight: 20 },
        {
          textContent: "Another long text element for testing",
          offsetWidth: 100,
          offsetHeight: 20,
        },
      ];

      return elements.filter((element) => {
        const text = element.textContent?.trim();
        return (
          text &&
          text.length >= 10 &&
          element.offsetWidth > 0 &&
          element.offsetHeight > 0
        );
      });
    }

    test("filters text elements correctly", () => {
      const elements = getTextElements({});
      expect(elements).toHaveLength(2);
      expect(elements[0].textContent).toBe(
        "This is a longer piece of text content",
      );
      expect(elements[1].textContent).toBe(
        "Another long text element for testing",
      );
    });
  });

  describe("Settings Validation", () => {
    function isValidFontSize(size) {
      return typeof size === "number" && size >= 2 && size <= 24;
    }

    function isValidZoomLevel(zoom) {
      return typeof zoom === "number" && zoom >= 1.0 && zoom <= 2.0;
    }

    test("validates font sizes", () => {
      expect(isValidFontSize(15)).toBe(true);
      expect(isValidFontSize(1)).toBe(false);
      expect(isValidFontSize(30)).toBe(false);
      expect(isValidFontSize("15")).toBe(false);
    });

    test("validates zoom levels", () => {
      expect(isValidZoomLevel(1.35)).toBe(true);
      expect(isValidZoomLevel(0.5)).toBe(false);
      expect(isValidZoomLevel(3.0)).toBe(false);
      expect(isValidZoomLevel("1.35")).toBe(false);
    });
  });

  describe("Message Handling Logic", () => {
    function processMessage(message) {
      const validActions = [
        "settingsUpdated",
        "reanalyze",
        "getZoom",
        "setZoom",
      ];

      if (!message || !message.action) {
        return { success: false, error: "Invalid message format" };
      }

      if (!validActions.includes(message.action)) {
        return { success: false, error: "Unknown action" };
      }

      return { success: true };
    }

    test("handles valid messages", () => {
      const result = processMessage({ action: "settingsUpdated" });
      expect(result.success).toBe(true);
    });

    test("rejects invalid messages", () => {
      const result = processMessage({ action: "invalid" });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown action");
    });

    test("handles malformed messages", () => {
      const result = processMessage(null);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid message format");
    });
  });
});
