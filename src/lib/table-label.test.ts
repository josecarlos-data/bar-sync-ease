import { describe, expect, it } from "vitest";
import { QR_OVERLAY_MAX_RATIO, qrOverlayDiameter, tableNumberFontSize } from "./table-label";

describe("table label overlay", () => {
  it("never occupies more than 20% of the QR width", () => {
    const qrWidth = 840;
    expect(qrOverlayDiameter(qrWidth)).toBeLessThanOrEqual(qrWidth * QR_OVERLAY_MAX_RATIO);
  });

  it("reduces the number size when the table has more digits", () => {
    expect(tableNumberFontSize(4)).toBeGreaterThan(tableNumberFontSize(104));
    expect(tableNumberFontSize(104)).toBeGreaterThan(tableNumberFontSize(1004));
  });
});