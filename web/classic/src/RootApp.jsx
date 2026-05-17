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

import React, { lazy, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import HomeShell from './pages/Home/HomeShell';

const PageLayout = lazy(() => import('./components/layout/PageLayout'));

const RootApp = () => {
  const location = useLocation();

  if (location.pathname === '/') {
    return <HomeShell />;
  }

  return (
    <Suspense fallback={<div className='route-shell-loading' />}>
      <PageLayout />
    </Suspense>
  );
};

export default RootApp;
