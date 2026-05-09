import { useRootStore } from '@shared/stores/rootStore';
import RootButton from './RootButton';

export default function TopBar() {
  const isRoot = useRootStore((s) => s.isRoot);
  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 24px', background: '#001529', color: '#fff',
      borderBottom: '2px solid #1677ff',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1 }}>路由器管理</span>
        {isRoot && <span style={{ fontSize: 11, color: '#faad14', background: 'rgba(250,173,20,0.15)', padding: '2px 8px', borderRadius: 4 }}>ROOT</span>}
      </div>
      <RootButton />
    </div>
  );
}
