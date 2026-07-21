// app/routes.tsx
import { createBrowserRouter } from 'react-router';
import RootLayout from './layout/RootLayout';
import PrescriptionsPage from '@/pages/prescriptions/PrescriptionsPage';
import ScanPage from '@/pages/scan/ScanPage';
import SettingsPage from '@/pages/settings/SettingsPage';
import ErrorPage from '@/pages/error/ErrorPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    errorElement: <ErrorPage />,
    children: [
      { index: true,        Component: PrescriptionsPage, errorElement: <ErrorPage /> },
      { path: 'scan',       Component: ScanPage,          errorElement: <ErrorPage /> },
      { path: 'settings',   Component: SettingsPage,      errorElement: <ErrorPage /> },
      { path: '*',          Component: ErrorPage },
    ],
  },
]);
