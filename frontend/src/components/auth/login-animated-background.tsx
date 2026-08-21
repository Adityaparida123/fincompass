import Image from "next/image";

const GIF_SRC = "/assets/login-background.gif";

export function LoginAnimatedBackground() {
  return (
    <div aria-hidden="true" className="login-bg">
      <Image
        src={GIF_SRC}
        alt=""
        fill
        unoptimized
        priority
        draggable={false}
        className="login-bg-media"
      />

      <div className="login-bg-static" />

      <div className="login-bg-overlay" />
      <div className="login-bg-fade" />
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />
      <div className="login-bg-vignette" />
    </div>
  );
}
