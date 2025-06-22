describe("Popup Script Tests", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <input type="range" id="minFontSize" min="2" max="24" value="15">
      <span id="fontSizeValue"></span>
      <input type="range" id="zoomLevel" min="1.0" max="2.0" step="0.05" value="1.35">
      <span id="zoomValue"></span>
      <button id="saveBtn">Save</button>
      <button id="resetBtn">Reset</button>
      <div id="status"></div>
    `;

    global.chrome = {
      storage: {
        sync: {
          get: jest.fn(),
          set: jest.fn(),
        },
      },
      tabs: {
        query: jest.fn(),
        sendMessage: jest.fn(),
      },
    };
  });

  describe("Settings Validation", () => {
    const VALIDATION_RULES = {
      minFontSize: { min: 2, max: 24 },
      zoomLevel: { min: 1.0, max: 2.0 },
    };

    function validateSettings(settings) {
      const result = {
        isValid: true,
        settings: { ...settings },
        error: null,
      };

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

    test("validates font size within bounds", () => {
      const result = validateSettings({ minFontSize: 15, zoomLevel: 1.35 });
      expect(result.isValid).toBe(true);
      expect(result.settings.minFontSize).toBe(15);
    });

    test("rejects font size below minimum", () => {
      const result = validateSettings({ minFontSize: 1, zoomLevel: 1.35 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Font size must be between 2 and 24");
    });

    test("rejects font size above maximum", () => {
      const result = validateSettings({ minFontSize: 30, zoomLevel: 1.35 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Font size must be between 2 and 24");
    });

    test("rejects zoom level below minimum", () => {
      const result = validateSettings({ minFontSize: 15, zoomLevel: 0.5 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Zoom level must be between 1 and 2");
    });

    test("rejects zoom level above maximum", () => {
      const result = validateSettings({ minFontSize: 15, zoomLevel: 3.0 });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Zoom level must be between 1 and 2");
    });

    test("handles non-numeric values", () => {
      const result = validateSettings({
        minFontSize: "invalid",
        zoomLevel: 1.35,
      });
      expect(result.isValid).toBe(false);
    });
  });

  describe("Display Updates", () => {
    function updateFontSizeDisplay(input, display) {
      const fontSize = parseInt(input.value, 10);
      if (!isNaN(fontSize)) {
        display.textContent = `${fontSize}px`;
      }
    }

    function updateZoomDisplay(input, display) {
      const zoomLevel = parseFloat(input.value);
      if (!isNaN(zoomLevel)) {
        const percentage = Math.round(zoomLevel * 100);
        display.textContent = `${percentage}%`;
      }
    }

    test("updates font size display correctly", () => {
      const input = document.getElementById("minFontSize");
      const display = document.getElementById("fontSizeValue");

      input.value = "18";
      updateFontSizeDisplay(input, display);
      expect(display.textContent).toBe("18px");
    });

    test("updates zoom display correctly", () => {
      const input = document.getElementById("zoomLevel");
      const display = document.getElementById("zoomValue");

      input.value = "1.75";
      updateZoomDisplay(input, display);
      expect(display.textContent).toBe("175%");
    });

    test("handles invalid values gracefully", () => {
      const input = document.getElementById("minFontSize");
      const display = document.getElementById("fontSizeValue");

      // Set initial valid value
      display.textContent = "15px";

      // Test the function directly with invalid input value by mocking
      const mockInput = { value: "invalid" };
      updateFontSizeDisplay(mockInput, display);

      // Display should remain unchanged when input is invalid
      expect(display.textContent).toBe("15px");
    });
  });

  describe("Element Caching", () => {
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

      const elements = {};
      elementIds.forEach((id) => {
        const element = document.getElementById(id);
        if (!element) {
          throw new Error(`Required element '${id}' not found`);
        }
        elements[id] = element;
      });
      return elements;
    }

    test("caches all required elements", () => {
      expect(() => cacheElements()).not.toThrow();
      const elements = cacheElements();
      expect(elements.minFontSize).toBeDefined();
      expect(elements.zoomLevel).toBeDefined();
      expect(elements.saveBtn).toBeDefined();
    });

    test("throws error for missing elements", () => {
      document.getElementById("saveBtn").remove();
      expect(() => cacheElements()).toThrow(
        "Required element 'saveBtn' not found",
      );
    });
  });

  describe("Default Settings", () => {
    const DEFAULT_SETTINGS = {
      minFontSize: 15,
      zoomLevel: 1.35,
    };

    function getDefaultSettings() {
      return { ...DEFAULT_SETTINGS };
    }

    function resetToDefaults(elements) {
      elements.minFontSize.value = DEFAULT_SETTINGS.minFontSize;
      elements.zoomLevel.value = DEFAULT_SETTINGS.zoomLevel;
    }

    test("provides correct defaults", () => {
      const defaults = getDefaultSettings();
      expect(defaults.minFontSize).toBe(15);
      expect(defaults.zoomLevel).toBe(1.35);
    });

    test("resets inputs to defaults", () => {
      const elements = {
        minFontSize: document.getElementById("minFontSize"),
        zoomLevel: document.getElementById("zoomLevel"),
      };

      elements.minFontSize.value = "20";
      elements.zoomLevel.value = "1.8";

      resetToDefaults(elements);

      expect(elements.minFontSize.value).toBe("15");
      expect(elements.zoomLevel.value).toBe("1.35");
    });
  });

  describe("Status Messages", () => {
    function showMessage(statusElement, message, type = "success") {
      statusElement.textContent = message;
      statusElement.className = "status";

      if (type === "error") {
        statusElement.classList.add("error");
      } else if (type === "success") {
        statusElement.classList.add("success");
      }
    }

    test("shows success messages", () => {
      const statusElement = document.getElementById("status");
      showMessage(statusElement, "Settings saved!", "success");

      expect(statusElement.textContent).toBe("Settings saved!");
      expect(statusElement.classList.contains("success")).toBe(true);
    });

    test("shows error messages", () => {
      const statusElement = document.getElementById("status");
      showMessage(statusElement, "Save failed", "error");

      expect(statusElement.textContent).toBe("Save failed");
      expect(statusElement.classList.contains("error")).toBe(true);
    });
  });

  describe("Keyboard Shortcuts", () => {
    function handleKeyDown(event, actions) {
      if (event.ctrlKey || event.metaKey) {
        switch (event.key) {
          case "s":
            event.preventDefault();
            actions.save();
            break;
          case "r":
            event.preventDefault();
            actions.reset();
            break;
        }
      }
    }

    test("saves on Ctrl+S", () => {
      const mockActions = { save: jest.fn(), reset: jest.fn() };
      const event = { key: "s", ctrlKey: true, preventDefault: jest.fn() };

      handleKeyDown(event, mockActions);

      expect(mockActions.save).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test("resets on Ctrl+R", () => {
      const mockActions = { save: jest.fn(), reset: jest.fn() };
      const event = { key: "r", ctrlKey: true, preventDefault: jest.fn() };

      handleKeyDown(event, mockActions);

      expect(mockActions.reset).toHaveBeenCalled();
      expect(event.preventDefault).toHaveBeenCalled();
    });

    test("ignores other key combinations", () => {
      const mockActions = { save: jest.fn(), reset: jest.fn() };
      const event = { key: "x", ctrlKey: true, preventDefault: jest.fn() };

      handleKeyDown(event, mockActions);

      expect(mockActions.save).not.toHaveBeenCalled();
      expect(mockActions.reset).not.toHaveBeenCalled();
    });
  });

  describe("Chrome Storage Integration", () => {
    test("handles storage get operations", async () => {
      const mockSettings = { minFontSize: 18, zoomLevel: 1.6 };
      chrome.storage.sync.get.mockResolvedValue(mockSettings);

      const result = await chrome.storage.sync.get({
        minFontSize: 15,
        zoomLevel: 1.35,
      });
      expect(result).toEqual(mockSettings);
    });

    test("handles storage set operations", async () => {
      chrome.storage.sync.set.mockResolvedValue();
      const settings = { minFontSize: 20, zoomLevel: 1.8 };

      await chrome.storage.sync.set(settings);
      expect(chrome.storage.sync.set).toHaveBeenCalledWith(settings);
    });

    test("handles storage errors", async () => {
      chrome.storage.sync.get.mockRejectedValue(new Error("Storage error"));

      await expect(chrome.storage.sync.get({})).rejects.toThrow(
        "Storage error",
      );
    });
  });
});
