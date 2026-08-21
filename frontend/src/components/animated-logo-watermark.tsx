import Image from "next/image";

const LOGO_SRC = "/assets/fincompass-logo.png";

export function AnimatedLogoWatermark() {
  return (
    <div aria-hidden="true" className="watermark">
      <div className="watermark-aura" />
      <Image
        src={LOGO_SRC}
        alt=""
        width={1024}
        height={1024}
        unoptimized
        priority
        draggable={false}
        className="watermark-logo"
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </div>
  );
}
