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

import React from 'react';
import { Button, Dropdown } from '@douyinfe/semi-ui';
import { Languages } from 'lucide-react';

const languageOptions = [
  { value: 'zh-CN', label: '简体中文', shortLabel: '简' },
  { value: 'zh-TW', label: '繁體中文', shortLabel: '繁' },
  { value: 'en', label: 'English', shortLabel: 'EN' },
  { value: 'fr', label: 'Français', shortLabel: 'FR' },
  { value: 'ja', label: '日本語', shortLabel: '日' },
  { value: 'ru', label: 'Русский', shortLabel: 'RU' },
  { value: 'vi', label: 'Tiếng Việt', shortLabel: 'VI' },
];

const languageLabels = languageOptions.reduce((labels, option) => {
  labels[option.value] = option.label;
  return labels;
}, {});

const LanguageSelector = ({ currentLang, onLanguageChange, t }) => {
  const currentOption =
    languageOptions.find((option) => option.value === currentLang) ||
    languageOptions[0];
  const currentLabel = languageLabels[currentLang] || languageLabels['zh-CN'];

  return (
    <Dropdown
      position='bottomRight'
      render={
        <Dropdown.Menu className='aihubmix-language-menu !bg-semi-color-bg-overlay !border-semi-color-border !shadow-lg !rounded-lg dark:!bg-gray-700 dark:!border-gray-600'>
          {languageOptions.map((option) => (
            <Dropdown.Item
              key={option.value}
              onClick={() => onLanguageChange(option.value)}
              className={`!px-3 !py-1.5 !text-sm !text-semi-color-text-0 dark:!text-gray-200 ${currentLang === option.value ? '!bg-semi-color-primary-light-default dark:!bg-blue-600 !font-semibold' : 'hover:!bg-semi-color-fill-1 dark:hover:!bg-gray-600'}`}
            >
              <span className='aihubmix-language-item'>{option.label}</span>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      }
    >
      <Button
        icon={<Languages size={18} />}
        aria-label={t('common.changeLanguage')}
        theme='borderless'
        type='tertiary'
        className='aihubmix-language-button !p-1.5 !text-current focus:!bg-semi-color-fill-1 dark:focus:!bg-gray-700 !rounded-full !bg-semi-color-fill-0 dark:!bg-semi-color-fill-1 hover:!bg-semi-color-fill-1 dark:hover:!bg-semi-color-fill-2'
      >
        <span className='aihubmix-language-label'>{currentLabel}</span>
        <span className='aihubmix-language-short'>{currentOption.shortLabel}</span>
      </Button>
    </Dropdown>
  );
};

export default LanguageSelector;
