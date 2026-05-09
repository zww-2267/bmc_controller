// API Client — 当前使用 Mock 数据，后续替换为真实 Axios 调用

// 模拟网络延迟
function delay(ms: number = 200): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms + Math.random() * 300));
}

// 通用 mock 请求包装器
export async function apiGet<T>(data: T, delayMs?: number): Promise<T> {
  await delay(delayMs);
  return JSON.parse(JSON.stringify(data)); // deep clone 避免引用污染
}

export async function apiPost<R>(data: R, delayMs?: number): Promise<R> {
  await delay(delayMs);
  return JSON.parse(JSON.stringify(data));
}

export async function apiDelete(delayMs?: number): Promise<{ success: boolean }> {
  await delay(delayMs);
  return { success: true };
}
