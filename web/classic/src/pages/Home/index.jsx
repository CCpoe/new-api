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
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Boxes,
  Bot,
  Check,
  ChevronRight,
  Copy,
  Gift,
  Package,
  Route,
} from 'lucide-react';
import './home.css';
import { getHomeCopy } from './homeCopy';


const API_SAMPLE_CODE = `from openai import OpenAI

client = OpenAI(
    api_key = "sk-***",
    base_url = "https://aihubmix.com/v1"
)

response = client.chat.completions.create(
    model = "claude-sonnet-4-20250514",
    messages = [{"role":"user","content":"Hi"}]
)`;

const CODE_LINES = [
  [<><span className='code-token-keyword'>from</span> <span className='code-token-module'>openai</span> <span className='code-token-keyword'>import</span> <span className='code-token-class'>OpenAI</span></>],
  [<></>],
  [<><span className='code-token-var'>client</span> = <span className='code-token-class'>OpenAI</span>(</>],
  [<>&nbsp;&nbsp;&nbsp;&nbsp;<span className='code-token-prop'>api_key</span> = <span className='code-token-string'>"sk-***"</span>,</>],
  [<>&nbsp;&nbsp;&nbsp;&nbsp;<span className='code-token-prop'>base_url</span> = <span className='code-token-string'>"https://aihubmix.com/v1"</span></>],
  [<>)</>],
  [<></>],
  [<><span className='code-token-var'>response</span> = <span className='code-token-var'>client</span>.<span className='code-token-prop'>chat</span>.<span className='code-token-prop'>completions</span>.<span className='code-token-fn'>create</span>(</>],
  [<>&nbsp;&nbsp;&nbsp;&nbsp;<span className='code-token-prop'>model</span> = <span className='code-token-string'>"claude-sonnet-4-20250514"</span>,</>],
  [<>&nbsp;&nbsp;&nbsp;&nbsp;<span className='code-token-prop'>messages</span> = [&#123;<span className='code-token-string'>"role"</span>:<span className='code-token-string'>"user"</span>,<span className='code-token-string'>"content"</span>:<span className='code-token-string'>"Hi"</span>&#125;]</>],
  [<>)</>],
];

const ApiCodePanel = () => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(API_SAMPLE_CODE);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = API_SAMPLE_CODE;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      setCopied(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      setCopied(false);
    }
  };

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return (
    <div className='api-code-panel'>
      <button className='api-code-copy' type='button' onClick={handleCopy} aria-label={'\u590d\u5236\u4ee3\u7801'}>
        <Copy size={12} />
        <span>{copied ? '\u5df2\u590d\u5236' : '\u590d\u5236'}</span>
      </button>
      <pre aria-label='OpenAI compatible API example'>
        <code>
          {CODE_LINES.map((line, index) => (
            <span className='api-code-line' key={index}>
              <span className='api-code-line-number'>{index + 1}</span>
              <span className='api-code-line-content'>{line}</span>
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
};
const InteractiveWorldMap = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const scene = canvas?.parentElement;
    if (!canvas || !scene) return undefined;

    const ctx = canvas.getContext('2d');
    const image = new Image();
    const pointer = { x: 0, y: 0, active: false };
    let points = [];
    let frameId = 0;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const sampleMap = () => {
      if (!image.complete || !width || !height) return;

      const sampleCanvas = document.createElement('canvas');
      const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });
      const sampleWidth = Math.max(260, Math.round(width / 2));
      const sampleHeight = Math.max(130, Math.round(height / 2));
      const step = width < 720 ? 6 : 5;

      sampleCanvas.width = sampleWidth;
      sampleCanvas.height = sampleHeight;
      sampleCtx.clearRect(0, 0, sampleWidth, sampleHeight);
      sampleCtx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

      const data = sampleCtx.getImageData(0, 0, sampleWidth, sampleHeight).data;
      const nextPoints = [];

      for (let y = 0; y < sampleHeight; y += step) {
        for (let x = 0; x < sampleWidth; x += step) {
          const alpha = data[(y * sampleWidth + x) * 4 + 3];
          if (alpha < 34) continue;

          const px = (x / sampleWidth) * width;
          const py = (y / sampleHeight) * height;
          nextPoints.push({
            ox: px,
            oy: py,
            x: px,
            y: py,
            phase: Math.random() * Math.PI * 2,
            size: 0.85 + Math.random() * 0.65,
          });
        }
      }

      points = nextPoints;
    };

    const resize = () => {
      const rect = scene.getBoundingClientRect();
      width = Math.max(1, rect.width);
      height = Math.max(1, rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sampleMap();
    };

    const handlePointerMove = (event) => {
      const rect = scene.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.active = pointer.x >= 0 && pointer.x <= rect.width && pointer.y >= 0 && pointer.y <= rect.height;
    };

    const handlePointerLeave = () => {
      pointer.active = false;
    };

    const render = (time) => {
      ctx.clearRect(0, 0, width, height);

      const radius = width < 720 ? 76 : 96;
      const radiusSq = radius * radius;

      for (const point of points) {
        let targetX = point.ox;
        let targetY = point.oy;
        let influence = 0;

        if (pointer.active) {
          const dx = point.ox - pointer.x;
          const dy = point.oy - pointer.y;
          const distanceSq = dx * dx + dy * dy;

          if (distanceSq < radiusSq) {
            const distance = Math.max(1, Math.sqrt(distanceSq));
            influence = 1 - distance / radius;
            const normalX = dx / distance;
            const normalY = dy / distance;
            const tangentX = -normalY;
            const tangentY = normalX;
            const orbit = Math.sin(time * 0.004 + point.phase) * 6;

            targetX += normalX * influence * 22 + tangentX * influence * (18 + orbit);
            targetY += normalY * influence * 22 + tangentY * influence * (18 + orbit);
          }
        }

        point.x += (targetX - point.x) * 0.18;
        point.y += (targetY - point.y) * 0.18;

        const pulse = (Math.sin(time * 0.002 + point.phase) + 1) * 0.5;
        const alpha = 0.26 + pulse * 0.12 + influence * 0.52;
        const pointRadius = point.size + influence * 0.9;

        ctx.beginPath();
        ctx.fillStyle = influence > 0.12
          ? `rgba(37, 99, 235, ${alpha})`
          : `rgba(100, 139, 184, ${alpha})`;
        ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pointer.active) {
        const gradient = ctx.createRadialGradient(pointer.x, pointer.y, 12, pointer.x, pointer.y, radius);
        gradient.addColorStop(0, 'rgba(37, 99, 235, 0.16)');
        gradient.addColorStop(0.55, 'rgba(37, 99, 235, 0.06)');
        gradient.addColorStop(1, 'rgba(37, 99, 235, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pointer.x, pointer.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      frameId = window.requestAnimationFrame(render);
    };

    image.onload = () => {
      resize();
      frameId = window.requestAnimationFrame(render);
    };
    image.src = '/aihubmix-world-map.svg';

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return <canvas className='aihubmix-map-canvas' ref={canvasRef} aria-hidden='true' />;
};
const Home = () => {
  const { i18n } = useTranslation();
  const copy = getHomeCopy(i18n.language);

  return (
    <main className='aihubmix-home'>
      <section className='aihubmix-hero' aria-label={copy.heroAria}>
        <div className='aihubmix-map-scene' aria-hidden='true'>
          <img className='aihubmix-map-source' src='/aihubmix-world-map.svg' alt='' />
          <InteractiveWorldMap />
          <div className='aihubmix-map-sweep'></div>
          <span className='map-spark map-spark-1'></span>
          <span className='map-spark map-spark-2'></span>
          <span className='map-spark map-spark-3'></span>
          <span className='map-spark map-spark-4'></span>
          <span className='map-spark map-spark-5'></span>
        </div>

        <div className='aihubmix-hero-copy'>
          <h1>{copy.heroTitle}</h1>
          <p>{copy.heroSubtitle}</p>
          <div className='aihubmix-hero-actions'>
            <Link className='aihubmix-btn aihubmix-btn-ghost' to='/about'>
              {copy.docs}
            </Link>
            <Link className='aihubmix-btn aihubmix-btn-primary' to='/console'>
              {copy.primaryCta} <ArrowRight size={20} />
            </Link>
          </div>
        </div>

        <div className='aihubmix-feature-strip' aria-label={copy.featuresAria}>
          <article className='aihubmix-feature-card coverage-card'>
            <h3>{copy.featureCoverageTitle}</h3>
            <div className='coverage-asset coverage-image' aria-hidden='true'>
              <img src='/kkcode-coverage-map.png' alt='' loading='lazy' decoding='async' />
            </div>
          </article>

          <article className='aihubmix-feature-card code-card'>
            <h3>{copy.featureApiTitle}</h3>
            <ApiCodePanel />
          </article>

          <article className='aihubmix-feature-card routing-card'>
            <h3>{copy.featureRoutingTitle}</h3>
            <div className='concurrency-carousel' aria-hidden='true'>
              <img src='/aihubmix-card-concurrency-1.png' alt='' loading='lazy' decoding='async' />
              <img src='/aihubmix-card-concurrency-2.png' alt='' loading='lazy' decoding='async' />
              <img src='/aihubmix-card-concurrency-3.png' alt='' loading='lazy' decoding='async' />
            </div>
          </article>
        </div>
      </section>

      <section className='aihubmix-ecosystem'>
        <h2>{copy.ecosystemTitle}</h2>
        <p>{copy.ecosystemSubtitle}</p>
        <div className='partner-grid'>
          {copy.partners.map((partner, index) => (
            <div className='partner-tile' key={partner}>
              <span className={`partner-mark partner-mark-${index + 1}`}>
                {index === 1 ? <Gift size={22} /> : <Package size={22} />}
              </span>
              <strong>{partner}</strong>
            </div>
          ))}
          <div className='partner-tile partner-more'>...</div>
          <Link className='partner-coupon' to='/register'>
            <Check size={22} />
            <span>{copy.discountLine1}<br />{copy.discountLine2}</span>
          </Link>
        </div>
      </section>

      <section className='aihubmix-more'>
        <div className='more-panel'>
          <Bot size={28} />
          <h2>{copy.morePanels[0].title}</h2>
          <p>{copy.morePanels[0].text}</p>
          <Link to='/pricing'>{copy.morePanels[0].link} <ChevronRight size={18} /></Link>
        </div>
        <div className='more-panel'>
          <Route size={28} />
          <h2>{copy.morePanels[1].title}</h2>
          <p>{copy.morePanels[1].text}</p>
          <Link to='/console/playground'>{copy.morePanels[1].link} <ChevronRight size={18} /></Link>
        </div>
        <div className='more-panel'>
          <Boxes size={28} />
          <h2>{copy.morePanels[2].title}</h2>
          <p>{copy.morePanels[2].text}</p>
          <Link to='/about'>{copy.morePanels[2].link} <ChevronRight size={18} /></Link>
        </div>
      </section>

      <footer className='aihubmix-footer'>
        <div className='footer-brand-line'>
          <img src='/kkcode-logo.svg' alt='Kcode' />
        </div>
        <span>{copy.footerTagline}</span>
      </footer>

      <button className='aihubmix-notice' type='button' aria-label={copy.notice}>
        <Bell size={21} />
        <span>{copy.notice}</span>
      </button>
    </main>
  );
};
export default Home;




