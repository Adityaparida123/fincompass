const VIDEO_SRC = "/assets/login-background.mp4";

export function LoginAnimatedBackground() {
  return (
    <div aria-hidden="true" className="login-bg">
      <video
        className="login-bg-media"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>

      <div className="login-bg-static" />

      <div className="login-bg-overlay" />
      <div className="login-bg-fade" />
      <div className="login-bg-grid" />
      <div className="login-bg-glow" />
      <div className="login-bg-vignette" />
    </div>
  );
}
