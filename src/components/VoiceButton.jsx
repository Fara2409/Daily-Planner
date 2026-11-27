// Кнопка микрофона: нажал — говоришь, нажал ещё раз — отправляется на распознавание.
import { useEffect, useRef, useState } from 'react';
import { startRecording, parseVoice, voiceSupported, MAX_SECONDS } from '../lib/voice.js';

const MicIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
       strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="9" y="2" width="6" height="12" rx="3" />
    <path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8" />
  </svg>
);

export default function VoiceButton({ t, onResult, onError }) {
  const [state, setState] = useState('idle'); // idle | recording | processing
  const [seconds, setSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const rec = useRef(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  if (!voiceSupported()) return null;

  const stop = async () => {
    clearInterval(timer.current);
    if (!rec.current) return;
    setState('processing');
    try {
      const { blob, silent } = await rec.current.stop();
      rec.current = null;
      if (silent) throw { code: 'silent' };        // микрофон слышал только тишину — не тратим запрос
      if (blob.size < 1000) throw { code: 'empty' }; // почти ничего не записалось
      onResult(await parseVoice(blob));
    } catch (e) {
      console.error(e);
      onError(e?.code ?? 'ai_error');
    } finally {
      setState('idle');
    }
  };

  const start = async () => {
    try {
      rec.current = await startRecording(setLevel);
    } catch (e) {
      console.error(e);
      return onError('mic_denied');
    }
    setSeconds(0);
    setLevel(0);
    setState('recording');
    timer.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) stop();
        return s + 1;
      });
    }, 1000);
  };

  const click = () => (state === 'idle' ? start() : state === 'recording' ? stop() : null);

  return (
    <>
      {state !== 'idle' && (
        <div className="voice-status" role="status">
          {state === 'recording' ? (
            <>
              <span className="voice-dot" /> {t('listening')} 0:{String(seconds).padStart(2, '0')}
              <span className="voice-level" aria-hidden="true"><i style={{ width: `${Math.round(level * 100)}%` }} /></span>
              <span className="voice-hint">{t('tapToStop')}</span>
            </>
          ) : (
            <>
              <span className="spinner" /> {t('thinking')}
            </>
          )}
        </div>
      )}
      <button
        className={`mic${state === 'recording' ? ' is-recording' : ''}`}
        onClick={click}
        disabled={state === 'processing'}
        aria-label={t('voice')}
      >
        <MicIcon />
      </button>
    </>
  );
}
