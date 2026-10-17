import { navigate } from "../notch/nav";
import { media } from "../platform/media";
import { mockDiscord, mockPrivacy } from "../platform/services";
import { settings, updateSettings } from "../settings/store";

/**
 * Browser only (`?showcase`): English UI and demo controls.
 * `window.__showcase` lets a capture script start a call or the music.
 */
export function startShowcase() {
  updateSettings({
    language: "en",
    openMode: "hover",
    weather: { name: "Amsterdam", lat: 52.37, lon: 4.89, auto: false },
  });
  navigate("overview");

  Object.assign(window, {
    __showcase: {
      play: () => !media.get()?.isPlaying && media.toggle(),
      pause: () => media.get()?.isPlaying && media.toggle(),
      // A call also lights the green mic dot, like on the iPhone.
      call: (on: boolean) => {
        mockPrivacy.mic = on;
        if (on !== !!mockDiscord.get().call) mockDiscord.toggleCall();
      },
      navigate,
      settings,
    },
  });
}
