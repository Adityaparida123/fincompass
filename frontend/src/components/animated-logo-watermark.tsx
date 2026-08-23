import { useState } from "react";
import Image from "next/image";
import { Compass } from "lucide-react";

const LOGO_SRC = "/assets/fincompass-logo.svg";

export function AnimatedLogoWatermark() {
  const [logoMissing, setLogoMissing] = useState(false);
  const [logoReady, setLogoReady] = useState(false);

  return (
    <div aria-hidden="true" className="watermark">
      <div className="watermark-aura" />
      {logoMissing ? (
        <div className="watermark-figure">
          <Compass className="watermark-glyph" />
        </div>
      ) : (
        <div className="watermark-figure">
          <Image
            src={LOGO_SRC}
            alt=""
            width={1024}
            height={1024}
            unoptimized
            priority
            draggable={false}
            className="watermark-img"
            onError={() => setLogoMissing(true)}
            onLoad={() => setLogoReady(true)}
          />
          {logoReady && <div className="watermark-tint" />}
        </div>
      )}
    </div>
  );
}
