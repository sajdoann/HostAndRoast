import { useEffect, useState } from "react";
import QR from "qrcode";

/** Renders a QR code for `value` as an <img>. */
export default function QRCode({ value, size = 240 }: { value: string; size?: number }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    let alive = true;
    QR.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#1a1a1a", light: "#ffffff" },
    })
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(""));
    return () => {
      alive = false;
    };
  }, [value, size]);

  if (!src) return <div className="qr-fallback" style={{ width: size, height: size }} />;
  return <img className="qr" width={size} height={size} src={src} alt={value} />;
}
