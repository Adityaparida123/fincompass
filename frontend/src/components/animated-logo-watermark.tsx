import { useState } from "react";
import Image from "next/image";
import { Compass } from "lucide-react";

const LOGO_SRC = "/assets/fincompass-logo.png";

export function AnimatedLogoWatermark() {
  const [logoMissing, setLogoMissing] = useState(false);

  return (
    <div aria-hidden="true" className="watermark">
      <div className="watermark-aura" />
      {logoMissing ? (
        <Compass className="watermark-logo watermark-logo-glyph" />
      ) : (
        <Image
          src={LOGO_SRC}
          alt=""
          width={1024}
          height={1024}
          unoptimized
          priority
          draggable={false}
          className="watermark-logo"
          onError={() => setLogoMissing(true)}
        />
      )}
    </div>
  );
}
