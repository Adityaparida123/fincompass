import { Compass } from "lucide-react";

export function AnimatedLogoWatermark() {
  return (
    <div aria-hidden="true" className="watermark">
      <Compass className="watermark-logo" />
    </div>
  );
}
