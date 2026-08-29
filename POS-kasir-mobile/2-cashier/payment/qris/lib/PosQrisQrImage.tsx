import QRCode from "react-qr-code";

type Props = {
  qrString: string;
  size?: number;
};

export function PosQrisQrImage({ qrString, size = 260 }: Props) {
  if (!qrString.trim()) return null;
  return (
    <div className="rounded-lg bg-white p-2">
      <QRCode value={qrString} size={size} style={{ height: "auto", maxWidth: "100%", width: "100%" }} />
    </div>
  );
}
