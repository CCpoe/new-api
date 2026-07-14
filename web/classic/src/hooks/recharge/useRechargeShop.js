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

import { useCallback, useEffect, useState } from 'react';
import { API } from '../../helpers';

let rechargeShopState = {
  status: 'idle',
  enabled: false,
  url: '',
  error: null,
};
let rechargeShopRequest = null;
const rechargeShopListeners = new Set();

const publishRechargeShopState = (nextState) => {
  rechargeShopState = nextState;
  rechargeShopListeners.forEach((listener) => listener(nextState));
};

const loadRechargeShop = ({ force = false } = {}) => {
  if (rechargeShopRequest) {
    return rechargeShopRequest;
  }
  if (!force && rechargeShopState.status === 'success') {
    return Promise.resolve(rechargeShopState);
  }

  publishRechargeShopState({
    ...rechargeShopState,
    status: 'loading',
    error: null,
  });

  rechargeShopRequest = API.get('/api/user/recharge-shop')
    .then((response) => {
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to load recharge');
      }

      const url = String(response.data.data?.url || '').trim();
      const nextState = {
        status: 'success',
        enabled: response.data.data?.enabled === true && url !== '',
        url,
        error: null,
      };
      publishRechargeShopState(nextState);
      return nextState;
    })
    .catch((error) => {
      const nextState = {
        status: 'error',
        enabled: false,
        url: '',
        error,
      };
      publishRechargeShopState(nextState);
      return nextState;
    })
    .finally(() => {
      rechargeShopRequest = null;
    });

  return rechargeShopRequest;
};

export const refreshRechargeShop = () => loadRechargeShop({ force: true });

export const useRechargeShop = () => {
  const [state, setState] = useState(rechargeShopState);

  useEffect(() => {
    rechargeShopListeners.add(setState);
    setState(rechargeShopState);
    loadRechargeShop();

    return () => {
      rechargeShopListeners.delete(setState);
    };
  }, []);

  const reload = useCallback(() => refreshRechargeShop(), []);

  return {
    ...state,
    loading: state.status === 'idle' || state.status === 'loading',
    reload,
  };
};
