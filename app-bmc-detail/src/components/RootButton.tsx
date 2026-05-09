import { useState } from 'react';
import { Button, Input, Modal, App } from 'antd';
import { LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useRootStore } from '@shared/stores/rootStore';

export default function RootButton() {
  const { isRoot, unlock, lock } = useRootStore();
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');

  const handleUnlock = async () => {
    if (await unlock(pwd)) { message.success('已进入 Root 模式'); setOpen(false); setPwd(''); }
    else message.error('密码错误');
  };

  return (
    <>
      {isRoot ? (
        <Button ghost icon={<LockOutlined />} onClick={lock}>退出 Root</Button>
      ) : (
        <Button ghost icon={<UnlockOutlined />} onClick={() => setOpen(true)}>Root</Button>
      )}
      <Modal title="Root 验证" open={open} onOk={handleUnlock} onCancel={() => { setOpen(false); setPwd(''); }}>
        <Input.Password placeholder="Root 密码" value={pwd} onChange={(e) => setPwd(e.target.value)} onPressEnter={handleUnlock} />
      </Modal>
    </>
  );
}
