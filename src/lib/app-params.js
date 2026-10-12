const isNode = typeof window === 'undefined';
const isClearAccessTokenRequested = () =>
  !isNode &&
  new URLSearchParams(window.location.search).get('clear_access_token') === 'true';

const clearStoredAccessToken = () => {
  if (isNode) return;
  window.localStorage.removeItem('base44_access_token');
  window.localStorage.removeItem('token');
};

const getAccessToken = () => {
  if (isNode) return '';
  return (
    localStorage.getItem('base44_access_token') ||
    localStorage.getItem('token') ||
    ''
  );
};

const getAppParams = () => {
  if (isClearAccessTokenRequested()) {
    clearStoredAccessToken();
  }
  return {
    appId: 'poker-action-tracker',
    token: getAccessToken(),
    functionsVersion: '1.0.0',
    appBaseUrl: isNode ? '' : window.location.origin,
  };
};

export const appParams = { ...getAppParams() };
