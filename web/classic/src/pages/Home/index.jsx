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

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Bell, Boxes, Bot, Copy, Route } from 'lucide-react';
import { StatusContext } from '../../context/Status';
import { DEFAULT_DOCS_LINK } from '../../helpers/data';
import './home.css';
import { getHomeCopy } from './homeCopy';

const BaseUrlPanel = ({ serverAddress }) => {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  const baseUrl = serverAddress || window.location.origin;

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(baseUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = baseUrl;
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
    <div className='base-url-panel'>
      <span className='base-url-label'>替换基础 URL 即可接入</span>
      <div className='base-url-input' aria-label='Base URL preview'>
        <span className='base-url-text'>{baseUrl}</span>
        <button
          className='base-url-copy'
          type='button'
          onClick={handleCopy}
          aria-label='复制接入地址'
          title={copied ? '已复制' : '复制接入地址'}
        >
          <Copy size={15} />
        </button>
      </div>
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
      const sampleCtx = sampleCanvas.getContext('2d', {
        willReadFrequently: true,
      });
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
      pointer.active =
        pointer.x >= 0 &&
        pointer.x <= rect.width &&
        pointer.y >= 0 &&
        pointer.y <= rect.height;
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

            targetX +=
              normalX * influence * 22 + tangentX * influence * (18 + orbit);
            targetY +=
              normalY * influence * 22 + tangentY * influence * (18 + orbit);
          }
        }

        point.x += (targetX - point.x) * 0.18;
        point.y += (targetY - point.y) * 0.18;

        const pulse = (Math.sin(time * 0.002 + point.phase) + 1) * 0.5;
        const alpha = 0.26 + pulse * 0.12 + influence * 0.52;
        const pointRadius = point.size + influence * 0.9;

        ctx.beginPath();
        ctx.fillStyle =
          influence > 0.12
            ? `rgba(37, 99, 235, ${alpha})`
            : `rgba(100, 139, 184, ${alpha})`;
        ctx.arc(point.x, point.y, pointRadius, 0, Math.PI * 2);
        ctx.fill();
      }

      if (pointer.active) {
        const gradient = ctx.createRadialGradient(
          pointer.x,
          pointer.y,
          12,
          pointer.x,
          pointer.y,
          radius,
        );
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
    window.addEventListener('pointermove', handlePointerMove, {
      passive: true,
    });
    window.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <canvas
      className='aihubmix-map-canvas'
      ref={canvasRef}
      aria-hidden='true'
    />
  );
};
const Home = () => {
  const { i18n } = useTranslation();
  const [statusState] = useContext(StatusContext);
  const moreSectionRef = useRef(null);
  const [moreSectionVisible, setMoreSectionVisible] = useState(false);
  const copy = getHomeCopy(i18n.language);
  const docsLink = statusState?.status?.docs_link || DEFAULT_DOCS_LINK;
  const serverAddress = statusState?.status?.server_address || '';

  const showDocsButton = useMemo(() => {
    const headerNavModulesConfig = statusState?.status?.HeaderNavModules;
    if (!headerNavModulesConfig) {
      return true;
    }

    try {
      const modules = JSON.parse(headerNavModulesConfig);
      return modules.docs === true;
    } catch (error) {
      console.error('Failed to parse header navigation modules:', error);
      return true;
    }
  }, [docsLink, statusState?.status?.HeaderNavModules]);

  useEffect(() => {
    const section = moreSectionRef.current;
    if (!section || moreSectionVisible) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMoreSectionVisible(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.28,
        rootMargin: '0px 0px -12% 0px',
      },
    );

    observer.observe(section);

    return () => observer.disconnect();
  }, [moreSectionVisible]);

  return (
    <main className='aihubmix-home'>
      <section className='aihubmix-hero' aria-label={copy.heroAria}>
        <div className='aihubmix-map-scene' aria-hidden='true'>
          <img
            className='aihubmix-map-source'
            src='/aihubmix-world-map.svg'
            alt=''
          />
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
            {showDocsButton && (
              <a
                className='aihubmix-btn aihubmix-btn-ghost'
                href={docsLink}
                target='_blank'
                rel='noopener noreferrer'
              >
                {copy.docs}
              </a>
            )}
            <a className='aihubmix-btn aihubmix-btn-primary' href='/login'>
              {copy.primaryCta} <ArrowRight size={20} />
            </a>
          </div>
        </div>

        <div className='aihubmix-feature-strip' aria-label={copy.featuresAria}>
          <article className='aihubmix-feature-card coverage-card'>
            <h3>{copy.featureCoverageTitle}</h3>
            <div className='coverage-asset coverage-image' aria-hidden='true'>
              <img
                src='/kkcode-coverage-map.png'
                alt=''
                loading='lazy'
                decoding='async'
              />
            </div>
          </article>

          <article className='aihubmix-feature-card code-card'>
            <h3>{copy.featureApiTitle}</h3>
            <BaseUrlPanel serverAddress={serverAddress} />
          </article>

          <article className='aihubmix-feature-card routing-card'>
            <h3>{copy.featureRoutingTitle}</h3>
            <div className='concurrency-carousel' aria-hidden='true'>
              <img
                src='/aihubmix-card-concurrency-1.png'
                alt=''
                loading='lazy'
                decoding='async'
              />
              <img
                src='/aihubmix-card-concurrency-2.png'
                alt=''
                loading='lazy'
                decoding='async'
              />
              <img
                src='/aihubmix-card-concurrency-3.png'
                alt=''
                loading='lazy'
                decoding='async'
              />
            </div>
          </article>
        </div>
      </section>

      <section
        className={`aihubmix-more${moreSectionVisible ? ' aihubmix-more-visible' : ''}`}
        ref={moreSectionRef}
      >
        <div className='more-panel'>
          <Bot size={28} />
          <h2>{copy.morePanels[0].title}</h2>
          <p>{copy.morePanels[0].text}</p>
        </div>
        <div className='more-panel'>
          <Route size={28} />
          <h2>{copy.morePanels[1].title}</h2>
          <p>{copy.morePanels[1].text}</p>
        </div>
        <div className='more-panel'>
          <Boxes size={28} />
          <h2>{copy.morePanels[2].title}</h2>
          <p>{copy.morePanels[2].text}</p>
        </div>
      </section>

      <footer className='aihubmix-footer'>
        <div className='footer-brand-line'>
          <img src='/kkcode-logo.svg' alt='Kcode' />
        </div>
        <span>{copy.footerTagline}</span>
      </footer>

      <button
        className='aihubmix-notice'
        type='button'
        aria-label={copy.notice}
      >
        <Bell size={21} />
        <span>{copy.notice}</span>
      </button>
    </main>
  );
};
export default Home;
