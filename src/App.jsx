// «Привратник»: проверяет, вошёл ли человек.
// Не вошёл — показываем экран входа, вошёл — планировщик.
import { useEffect, useState } from 'react';
import LoginScreen from './components/LoginScreen.jsx';
import Planner from './Planner.jsx';
import { supabase } from './lib/supabase.js';
import { detectLang, translator } from './lib/i18n.js';
import { setSetting } from './lib/storage.js';

export default function App() {
  const [lang, setLang] = useState(detectLang);
  const [session, setSession] = useState(undefined); // undefined = ещё проверяем
  const [hold, setHold] = useState(false); // идёт смена пароля — пока остаёмся на экране входа

  const t = translator(lang);

  useEffect(() => {
    setSetting('lang', lang);
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    // 1) Есть ли уже сохранённый вход?
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    // 2) Следим за входом/выходом (в том числе когда Google вернул человека обратно)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div className="splash">{t('loading')}</div>;
  }

  if (!session || hold) {
    return <LoginScreen lang={lang} setLang={setLang} t={t} onHold={setHold} />;
  }

  return <Planner key={session.user.id} user={session.user} lang={lang} setLang={setLang} t={t} />;
}
