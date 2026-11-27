// Голосовой ввод: запись с микрофона и отправка на сервер (функция parse-voice).
import { supabase } from './supabase.js';
import { toISO, pad } from './dates.js';

export const MAX_SECONDS = 60;

// Формат записи: Chrome/Android пишет webm, Safari/iPhone — mp4.
function pickMimeType() {
  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/aac'];
  return candidates.find((t) => window.MediaRecorder?.isTypeSupported?.(t)) ?? '';
}

export const voiceSupported = () =>
  !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

// Порог громкости: ниже — считаем, что микрофон слышал только тишину.
const SILENCE_PEAK = 0.03;

// Начать запись. onLevel(0..1) вызывается ~10 раз в секунду — для полоски громкости.
// stop() возвращает { blob, silent }.
export async function startRecording(onLevel = () => {}) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Измеритель громкости: смотрим на звуковую волну и запоминаем самый громкий момент.
  let peak = 0;
  let meterTimer = null;
  let audioCtx = null;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 1024;
    audioCtx.createMediaStreamSource(stream).connect(analyser);
    const wave = new Float32Array(analyser.fftSize);
    meterTimer = setInterval(() => {
      analyser.getFloatTimeDomainData(wave);
      let sum = 0;
      for (const v of wave) sum += v * v;
      const rms = Math.sqrt(sum / wave.length);
      peak = Math.max(peak, rms);
      onLevel(Math.min(1, rms * 8));
    }, 100);
  } catch {
    peak = 1; // измерить не получилось — не мешаем записи
  }

  const mimeType = pickMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  const chunks = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const done = new Promise((resolve) => {
    recorder.onstop = () => {
      clearInterval(meterTimer);
      audioCtx?.close?.();
      stream.getTracks().forEach((t) => t.stop()); // выключить микрофон
      resolve({
        blob: new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/mp4' }),
        silent: peak < SILENCE_PEAK,
      });
    };
  });

  recorder.start();
  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
      return done;
    },
  };
}

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

// Отправить запись на сервер и получить разобранные дела.
// Возвращает { transcript, understood, tasks: [...] } или бросает ошибку с кодом.
export async function parseVoice(blob) {
  const d = new Date();
  const { data, error } = await supabase.functions.invoke('parse-voice', {
    body: {
      audio: await blobToBase64(blob),
      mimeType: blob.type,
      now: `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`,
      weekday: new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(d),
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  });

  if (error) {
    // Достаём код ошибки, который вернула наша функция (daily_limit, too_long...)
    let code = 'ai_error';
    try {
      const body = await error.context?.json?.();
      code = body?.error ?? code;
    } catch {
      /* ignore */
    }
    throw { code };
  }
  return data;
}
