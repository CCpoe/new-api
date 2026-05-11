/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React, { useEffect, useRef, useState } from 'react';

const SCRIPT_ID = 'cloudflare-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

const TurnstileBox = ({ enabled, siteKey, onVerify, className = '' }) => {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || !siteKey) {
      onVerify('');
      return undefined;
    }

    let cancelled = false;
    const animationFrame = window.requestAnimationFrame(() => {
      if (!cancelled) setVisible(true);
    });

    const renderWidget = () => {
      if (cancelled || !containerRef.current || !window.turnstile) return;

      try {
        if (widgetIdRef.current !== null) {
          window.turnstile.remove(widgetIdRef.current);
          widgetIdRef.current = null;
        }
        containerRef.current.innerHTML = '';
        onVerify('');

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'light',
          callback: (token) => {
            onVerify(token);
          },
          'expired-callback': () => {
            onVerify('');
          },
          'error-callback': () => {
            onVerify('');
          },
        });
      } catch (error) {
        onVerify('');
      }
    };

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(SCRIPT_ID);
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
    }

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
      const script = document.getElementById(SCRIPT_ID);
      script?.removeEventListener('load', renderWidget);
      if (window.turnstile && widgetIdRef.current !== null) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (error) {
          // Ignore cleanup errors from a widget that was already removed.
        }
        widgetIdRef.current = null;
      }
    };
  }, [enabled, siteKey, onVerify]);

  if (!enabled || !siteKey) {
    return null;
  }

  return (
    <div
      className={`overflow-hidden transition-[max-height,opacity,transform,margin] duration-300 ease-out motion-reduce:transition-none ${
        visible
          ? 'mt-2 max-h-[90px] translate-y-0 opacity-100'
          : 'mt-0 max-h-0 -translate-y-1 opacity-0'
      } ${className}`}
    >
      <div className='flex justify-center py-1'>
        <div className='w-[300px] max-w-full overflow-hidden rounded bg-white'>
          <div ref={containerRef} className='cf-turnstile' data-sitekey={siteKey} />
        </div>
      </div>
    </div>
  );
};

export default TurnstileBox;
