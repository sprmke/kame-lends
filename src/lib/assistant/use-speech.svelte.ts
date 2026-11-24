import { browser } from "$app/environment";

interface SpeechAlternative {
  transcript: string;
}
interface SpeechResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternative;
}
interface SpeechResultList {
  length: number;
  [index: number]: SpeechResult;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: SpeechResultList;
}
interface SpeechRecognitionErrorLike {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function recognitionCtor(): SpeechRecognitionCtor | null {
  if (!browser) return null;
  const win = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

export interface SpeechToText {
  readonly supported: boolean;
  readonly listening: boolean;
  readonly error: string | null;
  start(baseText: string, onText: (text: string) => void): void;
  stop(): void;
}

/** Web Speech API with interim results. Audio goes to the browser vendor. */
export function useSpeechToText(): SpeechToText {
  let recognition: SpeechRecognitionLike | null = null;
  const state = $state({ listening: false, error: null as string | null });
  const supported = recognitionCtor() !== null;

  function stop() {
    if (recognition) {
      recognition.onend = null;
      recognition.abort();
      recognition = null;
    }
    state.listening = false;
  }

  function start(baseText: string, onText: (text: string) => void) {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      state.error = "Voice input is not supported in this browser.";
      return;
    }
    stop();
    state.error = null;
    const engine = new Ctor();
    engine.lang = "en-PH";
    engine.continuous = false;
    engine.interimResults = true;
    engine.maxAlternatives = 1;
    recognition = engine;

    engine.onresult = (event) => {
      let finalText = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += text;
        else interim += text;
      }
      const prefix = baseText.trim();
      const spoken = `${finalText || interim}`.trim();
      onText([prefix, spoken].filter(Boolean).join(prefix ? " " : ""));
    };
    engine.onerror = (event) => {
      state.error =
        event.error === "not-allowed"
          ? "Microphone permission was denied. Allow it in your browser settings."
          : event.error === "no-speech"
            ? "I did not hear anything. Try again."
            : "Voice input stopped. Try again.";
      state.listening = false;
    };
    engine.onend = () => {
      state.listening = false;
      recognition = null;
    };

    try {
      engine.start();
      state.listening = true;
    } catch {
      state.error = "Voice input could not start.";
      state.listening = false;
    }
  }

  return {
    get supported() {
      return supported;
    },
    get listening() {
      return state.listening;
    },
    get error() {
      return state.error;
    },
    start,
    stop,
  };
}
