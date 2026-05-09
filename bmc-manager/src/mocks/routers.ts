import type { Router } from '../types';

export const mockRouters: Router[] = [
  { id: 'r-1', name: '核心路由器-A1', location: '北京-朝阳-机房A', description: '一层核心交换' },
  { id: 'r-2', name: '核心路由器-A2', location: '北京-朝阳-机房A', description: '二层核心交换' },
  { id: 'r-3', name: '汇聚路由器-B1', location: '北京-海淀-机房B', description: 'GPU 集群汇聚' },
  { id: 'r-4', name: '汇聚路由器-B2', location: '北京-海淀-机房B', description: '存储集群汇聚' },
  { id: 'r-5', name: '边缘路由器-C1', location: '上海-浦东-机房C', description: 'CDN 边缘节点' },
  { id: 'r-6', name: '边缘路由器-C2', location: '上海-浦东-机房C', description: '推理服务边缘' },
];
