import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Auth0Provider } from '@auth0/auth0-react';
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  
  <Auth0Provider
   domain="dev-eydbckiq4wqvn7iy.us.auth0.com"
    clientId="hKvJ5ykA2G9EcD5Cmtn4jfAUvCluKXk2"
  authorizationParams={{
    redirect_uri: window.location.origin
  }}
>
  <StrictMode>
  <App />
  </StrictMode>
</Auth0Provider>,
);

