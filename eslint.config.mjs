import { config } from '@n8n/node-cli/eslint';


export default [
  // 引入 n8n 的默认配置
  config,

  // 添加一个新的配置对象来覆盖特定规则
  {
    rules: {
      '@n8n/community-nodes/no-restricted-imports': 'off',
    }
  }
];