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
import { Link, useNavigate } from 'react-router-dom';
import { Languages, LogOut, UserCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Home from './index';
import { StatusContext } from '../../context/Status';
import { UserContext } from '../../context/User';
import { DEFAULT_DOCS_LINK, setStatusData } from '../../helpers/data';
import { normalizeLanguage, supportedLanguages } from '../../i18n/language';
import { useNavigation } from '../../hooks/common/useNavigation';

const languageOptions = [
  { value: 'zh-CN', label: '简体中文', shortLabel: '简' },
  { value: 'zh-TW', label: '繁體中文', shortLabel: '繁' },
  { value: 'en', label: 'English', shortLabel: 'EN' },
  { value: 'fr', label: 'Français', shortLabel: 'FR' },
  { value: 'ja', label: '日本語', shortLabel: '日' },
  { value: 'ru', label: 'Русский', shortLabel: 'RU' },
  { value: 'vi', label: 'Tiếng Việt', shortLabel: 'VI' },
].filter((option) => supportedLanguages.includes(option.value));

const parseHeaderNavModules = (config) => {
  if (!config) {
    return null;
  }

  try {
    const modules = JSON.parse(config);
    if (typeof modules.pricing === 'boolean') {
      modules.pricing = {
        enabled: modules.pricing,
        requireAuth: false,
      };
    }
    return modules;
  } catch (error) {
    console.error('Failed to parse header navigation modules:', error);
    return null;
  }
};

const HomeLanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const currentOption =
    languageOptions.find((option) => option.value === currentLang) ||
    languageOptions[0];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  return (
    <div className='aihubmix-language-dropdown' ref={dropdownRef}>
      <button
        className='aihubmix-language-button'
        type='button'
        aria-label={t('common.changeLanguage')}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Languages size={18} aria-hidden='true' />
        <span className='aihubmix-language-label'>{currentOption.label}</span>
        <span className='aihubmix-language-short'>
          {currentOption.shortLabel}
        </span>
      </button>

      {open && (
        <div className='aihubmix-language-menu' role='menu'>
          {languageOptions.map((option) => (
            <button
              key={option.value}
              className={`aihubmix-language-menu-item ${
                currentLang === option.value
                  ? 'aihubmix-language-menu-item-active'
                  : ''
              }`}
              type='button'
              role='menuitem'
              onClick={() => {
                onLanguageChange(option.value);
                setOpen(false);
              }}
            >
              <span className='aihubmix-language-item'>{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const HomeHeader = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [userState, userDispatch] = useContext(UserContext);
  const [statusState] = useContext(StatusContext);
  const [currentLang, setCurrentLang] = useState(
    normalizeLanguage(i18n.language) || 'zh-CN',
  );

  const headerNavModules = useMemo(
    () => parseHeaderNavModules(statusState?.status?.HeaderNavModules),
    [statusState?.status?.HeaderNavModules],
  );
  const docsLink = statusState?.status?.docs_link || DEFAULT_DOCS_LINK;
  const isSelfUseMode = statusState?.status?.self_use_mode_enabled || false;
  const { mainNavLinks } = useNavigation(t, docsLink, headerNavModules);
  const pricingRequireAuth = headerNavModules?.pricing?.requireAuth === true;

  useEffect(() => {
    const handleLanguageChanged = (language) => {
      setCurrentLang(normalizeLanguage(language) || 'zh-CN');
    };

    i18n.on('languageChanged', handleLanguageChanged);
    return () => i18n.off('languageChanged', handleLanguageChanged);
  }, [i18n]);

  const handleLanguageChange = async (lang) => {
    i18n.changeLanguage(lang);
    localStorage.setItem('i18nextLng', lang);
    setCurrentLang(lang);

    if (userState?.user?.id) {
      try {
        await fetch('/api/user/self', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ language: lang }),
        });
      } catch (error) {
        console.error('Failed to save language preference:', error);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/user/logout');
    } finally {
      userDispatch({ type: 'logout' });
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const renderLink = (link) => {
    if (link.itemKey === 'home' || link.itemKey === 'about') {
      return null;
    }

    const homeLabels = {
      console: mainNavLinks.find((item) => item.itemKey === 'console')?.text,
      pricing: mainNavLinks.find((item) => item.itemKey === 'pricing')?.text,
      docs: mainNavLinks.find((item) => item.itemKey === 'docs')?.text,
    };
    const label = homeLabels[link.itemKey] || link.text;
    const className =
      'flex-shrink-0 flex items-center gap-1 font-semibold rounded-md transition-all duration-200 ease-in-out p-2 hover:text-semi-color-primary';

    if (link.isExternal) {
      return (
        <a
          key={link.itemKey}
          href={link.externalLink}
          target='_blank'
          rel='noopener noreferrer'
          className={className}
        >
          <span>{label}</span>
        </a>
      );
    }

    let targetPath = link.to;
    if (link.itemKey === 'console' && !userState.user) {
      targetPath = '/login';
    }
    if (link.itemKey === 'pricing' && pricingRequireAuth && !userState.user) {
      targetPath = '/login';
    }

    return (
      <Link key={link.itemKey} to={targetPath} className={className}>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <header className='aihubmix-site-header text-semi-color-text-0'>
      <div className='w-full px-4'>
        <div className='aihubmix-header-shell flex items-center justify-between'>
          <Link to='/' className='group flex items-center aihubmix-header-logo'>
            <div className='relative aihubmix-header-logo-mark'>
              <img
                src='/kkcode-logo.svg'
                alt='logo'
                className='absolute inset-0 w-full h-full object-contain transition-all duration-200 group-hover:scale-105'
              />
            </div>
          </Link>

          <nav className='aihubmix-main-nav flex flex-1 items-center gap-1 lg:gap-2 mx-2 md:mx-4 overflow-x-auto whitespace-nowrap scrollbar-hide'>
            {mainNavLinks.map(renderLink)}
          </nav>

          <div className='aihubmix-home-actions flex items-center gap-2 md:gap-3'>
            <HomeLanguageSelector
              currentLang={currentLang}
              onLanguageChange={handleLanguageChange}
              t={t}
            />

            {userState.user ? (
              <div className='aihubmix-user-pill'>
                <Link to='/console/personal' className='aihubmix-user-link'>
                  <UserCircle size={17} />
                  <span>{userState.user.username}</span>
                </Link>
                <button
                  className='aihubmix-user-logout'
                  type='button'
                  onClick={handleLogout}
                  aria-label='Logout'
                >
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <div className='aihubmix-auth-actions'>
                <Link to='/login' className='aihubmix-auth-login'>
                  登录
                </Link>
                {!isSelfUseMode && (
                  <Link to='/register' className='aihubmix-auth-register'>
                    注册
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

const HomeShell = () => {
  const [, statusDispatch] = useContext(StatusContext);
  const [, userDispatch] = useContext(UserContext);

  useEffect(() => {
    document.body.classList.add('home-route');
    document.title = 'KKCode';

    const linkElement = document.querySelector("link[rel~='icon']");
    if (linkElement) {
      linkElement.href = '/logo.png?v=kkcode';
    }

    return () => {
      document.body.classList.remove('home-route');
    };
  }, []);

  useEffect(() => {
    const cachedUser = localStorage.getItem('user');
    if (cachedUser) {
      try {
        userDispatch({ type: 'login', payload: JSON.parse(cachedUser) });
      } catch (error) {
        localStorage.removeItem('user');
      }
    }

    fetch('/api/status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((res) => {
        if (res?.success) {
          statusDispatch({ type: 'set', payload: res.data });
          setStatusData(res.data);
        }
      })
      .catch((error) => {
        console.error('Failed to load status:', error);
      });
  }, [statusDispatch, userDispatch]);

  return (
    <>
      <HomeHeader />
      <Home />
    </>
  );
};

export default HomeShell;
