import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import zhCN from 'antd/locale/zh_CN';
import MonitorPage from './pages/MonitorPage';
import AdminLoginPage from '@shared/components/AdminLoginPage';
import AuthGuard from '@shared/components/AuthGuard';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
        <AntApp>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<AdminLoginPage appTitle="BMC 监控与分析" appSubtitle="管理员登录" />} />
              <Route path="/*" element={<AuthGuard><MonitorPage /></AuthGuard>} />
            </Routes>
          </BrowserRouter>
        </AntApp>
      </ConfigProvider>
    </QueryClientProvider>
  );
}
