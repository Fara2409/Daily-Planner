import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base — это путь, по которому сайт будет открываться на GitHub Pages:
// https://<ваш-ник>.github.io/Daily-Planner/
// Он должен совпадать с названием репозитория (с учётом регистра букв).
export default defineConfig({
  plugins: [react()],
  base: '/Daily-Planner/',
});
