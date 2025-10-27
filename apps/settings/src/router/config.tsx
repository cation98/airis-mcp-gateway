
import { lazy } from 'react';

const MCPDashboard = lazy(() => import('../pages/mcp-dashboard/page'));
const NotFound = lazy(() => import('../pages/NotFound'));

// React Router v7 route configuration
const routes = [
  {
    path: '/',
    element: <MCPDashboard />
  },
  {
    path: '/mcp-dashboard',
    element: <MCPDashboard />
  },
  {
    path: '*',
    element: <NotFound />
  }
];

export default routes;
