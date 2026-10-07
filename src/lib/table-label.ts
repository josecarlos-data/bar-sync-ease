import QRCode from "qrcode";

export const TABLE_LABEL_WIDTH_PX = 1200;
export const TABLE_LABEL_HEIGHT_PX = 1800;
export const TABLE_LABEL_WIDTH_MM = 60;
export const TABLE_LABEL_HEIGHT_MM = 90;
export const QR_SIZE_PX = 840;
export const QR_OVERLAY_MAX_RATIO = 0.2;

export function tableNumberFontSize(tableNumber: number) {
  const digits = String(tableNumber).length;
  if (digits <= 2) return 210;
  if (digits === 3) return 170;
  return 132;
}

export function qrOverlayDiameter(qrSize = QR_SIZE_PX) {
  return Math.floor(qrSize * 0.18);
}

export async function createTableLabelCanvas(tableNumber: number, url: string) {
  const canvas = document.createElement("canvas");
  canvas.width = TABLE_LABEL_WIDTH_PX;
  canvas.height = TABLE_LABEL_HEIGHT_PX;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas no disponible");

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#111111";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 250px Arial, sans-serif`;
  context.fillText(String(tableNumber), canvas.width / 2, 205);

  const qrCanvas = document.createElement("canvas");
  await QRCode.toCanvas(qrCanvas, url, {
    width: QR_SIZE_PX,
    margin: 4,
    errorCorrectionLevel: "H",
    color: { dark: "#111111", light: "#ffffff" },
  });
  const qrX = (canvas.width - QR_SIZE_PX) / 2;
  const qrY = 390;
  context.drawImage(qrCanvas, qrX, qrY, QR_SIZE_PX, QR_SIZE_PX);

  const diameter = qrOverlayDiameter();
  const radius = diameter / 2;
  const centerX = canvas.width / 2;
  const centerY = qrY + QR_SIZE_PX / 2;
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fillStyle = "#ffffff";
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = "#111111";
  context.stroke();

  context.fillStyle = "#111111";
  context.font = `800 ${tableNumberFontSize(tableNumber)}px Arial, sans-serif`;
  context.fillText(String(tableNumber), centerX, centerY + 2);

  context.font = "700 74px Arial, sans-serif";
  context.fillText("Escanea para pedir", canvas.width / 2, 1380);

  context.fillStyle = "#b7b7b7";
  context.textAlign = "right";
  context.font = "400 34px Arial, sans-serif";
  context.fillText("by JCSR", canvas.width - 62, canvas.height - 58);

  return canvas;
}

export async function createTableLabelDataUrl(tableNumber: number, url: string) {
  const canvas = await createTableLabelCanvas(tableNumber, url);
  return canvas.toDataURL("image/png");
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = dataUrl;
  anchor.download = filename;
  anchor.click();
}