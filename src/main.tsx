if (import.meta.env.DEV) {
  import("react-grab");
}

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Theme } from '@astryxdesign/core';
import { neutralTheme } from '@astryxdesign/theme-neutral/built';

import { ThemeProvider } from '@/state/ThemeContext';
import App from './App';
import '@astryxdesign/core/reset.css';
import '@astryxdesign/core/astryx.css';
import '@astryxdesign/theme-neutral/theme.css';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'perfect-scrollbar/css/perfect-scrollbar.css';
import 'react-nano-scrollbar/dist/index.css';
import '@fontsource/redaction-10/400.css';
import '@fontsource/redaction-10/700.css';
import './styles/global.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element #root not found in index.html');

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <Theme theme={neutralTheme} mode="light">
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </Theme>
    </BrowserRouter>
  </StrictMode>,
);
