import { describe, expect, it } from "vitest";
import { getVoiceLanguage, voiceErrorMessage } from "@/hooks/use-voice-input";

describe("voice configuration", () => {
  it("maps supported application locales to Indian speech languages", () => {
    expect(getVoiceLanguage("en")).toBe("en-IN");
    expect(getVoiceLanguage("hi")).toBe("hi-IN");
  });

  it("falls back to English for an unknown locale", () => {
    expect(getVoiceLanguage("fr")).toBe("en-IN");
  });

  it("maps browser recognition failures to friendly categories", () => {
    expect(voiceErrorMessage("not-allowed")).toBe("permission");
    expect(voiceErrorMessage("audio-capture")).toBe("unsupported");
    expect(voiceErrorMessage("no-speech")).toBe("empty");
    expect(voiceErrorMessage(undefined)).toBe("empty");
  });
});
